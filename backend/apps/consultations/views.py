from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from .models import Consultation
from .serializers import ConsultationSerializer
from apps.sync.services import record_and_broadcast_change

class ConsultationViewSet(viewsets.ModelViewSet):
    serializer_class = ConsultationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Consultation.objects.filter(client__user=user, is_deleted=False).select_related('client')

        client_id = self.request.query_params.get('client_id')
        if client_id:
            queryset = queryset.filter(client_id=client_id)

        q = self.request.query_params.get('q', '').strip()
        if q:
            queryset = queryset.filter(
                Q(reason__icontains=q) |
                Q(discussion__icontains=q) |
                Q(advice__icontains=q) |
                Q(summary__icontains=q) |
                Q(follow_up_notes__icontains=q) |
                Q(consultation_type__icontains=q)
            )

        consultation_type = self.request.query_params.get('type')
        if consultation_type:
            queryset = queryset.filter(consultation_type__iexact=consultation_type)

        follow_up_required = self.request.query_params.get('follow_up_required')
        if follow_up_required is not None:
            val = follow_up_required.lower() in ('true', '1')
            queryset = queryset.filter(follow_up_required=val)

        follow_up_completed = self.request.query_params.get('follow_up_completed')
        if follow_up_completed is not None:
            val = follow_up_completed.lower() in ('true', '1')
            queryset = queryset.filter(follow_up_completed=val)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(consultation_date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(consultation_date__lte=date_to)

        return queryset

    def perform_create(self, serializer):
        client = serializer.validated_data.get('client')
        if client and client.user != self.request.user:
            raise PermissionDenied("You do not have permission to record consultations for this client.")
        instance = serializer.save()
        record_and_broadcast_change(
            user=self.request.user,
            entity_type='consultation',
            entity_id=instance.id,
            operation='CREATE',
            version=instance.version,
            payload=ConsultationSerializer(instance).data,
        )

    def perform_update(self, serializer):
        # Auto-increment version on mutation for sync tracking
        instance = serializer.save()
        instance.version += 1
        instance.save(update_fields=['version'])
        record_and_broadcast_change(
            user=self.request.user,
            entity_type='consultation',
            entity_id=instance.id,
            operation='UPDATE',
            version=instance.version,
            payload=ConsultationSerializer(instance).data,
        )

    def perform_destroy(self, instance):
        # Soft-delete to preserve permanent consultation audit history
        instance.is_deleted = True
        instance.version += 1
        instance.save(update_fields=['is_deleted', 'version'])
        record_and_broadcast_change(
            user=self.request.user,
            entity_type='consultation',
            entity_id=instance.id,
            operation='DELETE',
            version=instance.version,
        )

    @action(detail=True, methods=['post'], url_path='toggle-follow-up')
    def toggle_follow_up(self, request, pk=None):
        """
        Toggles follow-up completed status with version increment.
        """
        consultation = self.get_object()
        consultation.follow_up_completed = not consultation.follow_up_completed
        consultation.version += 1
        consultation.save(update_fields=['follow_up_completed', 'version'])
        record_and_broadcast_change(
            user=request.user,
            entity_type='consultation',
            entity_id=consultation.id,
            operation='UPDATE',
            version=consultation.version,
            payload=ConsultationSerializer(consultation).data,
        )
        serializer = self.get_serializer(consultation)
        return Response(serializer.data, status=status.HTTP_200_OK)


