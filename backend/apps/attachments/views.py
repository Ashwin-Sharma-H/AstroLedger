from rest_framework import generics, permissions
from rest_framework.serializers import ModelSerializer, ValidationError
from rest_framework.exceptions import PermissionDenied
from .models import Attachment

class AttachmentSerializer(ModelSerializer):
    class Meta:
        model = Attachment
        fields = '__all__'

    def validate_file_name(self, value):
        stripped = value.strip()
        if not stripped:
            raise ValidationError("File name cannot be empty.")
        return stripped

class AttachmentListView(generics.ListCreateAPIView):
    serializer_class = AttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base_qs = Attachment.objects.filter(consultation__client__user=user)
        consultation_id = self.request.query_params.get('consultation_id')
        if consultation_id:
            return base_qs.filter(consultation_id=consultation_id)
        return base_qs

    def perform_create(self, serializer):
        consultation = serializer.validated_data.get('consultation')
        if consultation and consultation.client.user != self.request.user:
            raise PermissionDenied("You do not have permission to attach files to this consultation.")
        serializer.save()
