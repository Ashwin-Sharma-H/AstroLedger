from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Max, Min, Q
from .models import Client
from .serializers import ClientSerializer
from apps.sync.services import record_and_broadcast_change

class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Client.objects.filter(user=user, is_deleted=False).annotate(
            visit_count=Count('consultations', filter=Q(consultations__is_deleted=False)),
            last_consultation_date=Max('consultations__consultation_date', filter=Q(consultations__is_deleted=False)),
            first_consultation_date=Min('consultations__consultation_date', filter=Q(consultations__is_deleted=False))
        )
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        record_and_broadcast_change(
            user=self.request.user,
            entity_type='client',
            entity_id=instance.id,
            operation='CREATE',
            version=instance.version,
            payload=ClientSerializer(instance).data,
        )

    def perform_update(self, serializer):
        # Auto-increment version on mutation for sync tracking
        instance = serializer.save()
        instance.version += 1
        instance.save(update_fields=['version'])
        record_and_broadcast_change(
            user=self.request.user,
            entity_type='client',
            entity_id=instance.id,
            operation='UPDATE',
            version=instance.version,
            payload=ClientSerializer(instance).data,
        )

    def perform_destroy(self, instance):
        # Soft delete with version increment
        instance.is_deleted = True
        instance.version += 1
        instance.save(update_fields=['is_deleted', 'version'])
        record_and_broadcast_change(
            user=self.request.user,
            entity_type='client',
            entity_id=instance.id,
            operation='DELETE',
            version=instance.version,
        )

    @action(detail=True, methods=['get', 'post'])
    def consultations(self, request, pk=None):
        from apps.consultations.models import Consultation
        from apps.consultations.serializers import ConsultationSerializer

        client = self.get_object()
        if request.method == 'GET':
            qs = Consultation.objects.filter(client=client, is_deleted=False).order_by('-consultation_date', '-created_at')
            serializer = ConsultationSerializer(qs, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            serializer = ConsultationSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(client=client)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Advanced Multi-Attribute Search Engine:
        - Universal search query: 'q'
        - Specific field filters: 'name', 'phone', 'dob', 'birth_time', 'birth_place', 'birth_star', 'rashi'
        - Combination mode: 'all' (AND) or 'any' (OR with scoring)
        - Weighted relevancy ranking and matching field annotations
        """
        q = request.query_params.get('q', '').strip()
        name_param = request.query_params.get('name', '').strip()
        phone_param = request.query_params.get('phone', '').strip()
        dob_param = request.query_params.get('dob', '').strip()
        birth_time_param = request.query_params.get('birth_time', '').strip()
        birth_place_param = request.query_params.get('birth_place', '').strip()
        birth_star_param = request.query_params.get('birth_star', '').strip()
        rashi_param = request.query_params.get('rashi', '').strip()
        mode = request.query_params.get('mode', 'all').lower()

        qs = self.get_queryset()

        has_specific_filters = any([
            name_param, phone_param, dob_param, birth_time_param,
            birth_place_param, birth_star_param, rashi_param
        ])

        if has_specific_filters:
            conditions = []
            if name_param:
                conditions.append(Q(name__icontains=name_param))
            if phone_param:
                conditions.append(Q(phone__icontains=phone_param) | Q(alternate_phone__icontains=phone_param))
            if dob_param:
                conditions.append(Q(dob=dob_param))
            if birth_time_param:
                conditions.append(Q(birth_time__startswith=birth_time_param))
            if birth_place_param:
                conditions.append(Q(birth_place__icontains=birth_place_param))
            if birth_star_param:
                # Clean parenthetical script for flexible matching
                clean_star = birth_star_param.split('(')[0].strip()
                conditions.append(Q(birth_star__icontains=clean_star) | Q(birth_star__icontains=birth_star_param))
            if rashi_param:
                clean_rashi = rashi_param.split('(')[0].strip()
                conditions.append(Q(rashi__icontains=clean_rashi) | Q(rashi__icontains=rashi_param))

            if mode == 'any':
                filter_q = Q()
                for c in conditions:
                    filter_q |= c
                qs = qs.filter(filter_q)
            else:
                for c in conditions:
                    qs = qs.filter(c)

        elif q:
            clean_q = q.split('(')[0].strip()
            qs = qs.filter(
                Q(name__icontains=clean_q) |
                Q(phone__icontains=clean_q) |
                Q(alternate_phone__icontains=clean_q) |
                Q(client_code__icontains=clean_q) |
                Q(birth_place__icontains=clean_q) |
                Q(birth_star__icontains=clean_q) |
                Q(rashi__icontains=clean_q) |
                Q(dob__icontains=clean_q)
            )

        # Compute match fields and relevancy score
        results = []
        search_term = q.lower()

        for client in qs[:60]:
            matched_fields = []
            score = 0
            c_name = (client.name or '').lower()
            c_phone = (client.phone or '').lower()
            c_code = (client.client_code or '').lower()
            c_place = (client.birth_place or '').lower()
            c_star = (client.birth_star or '').lower()
            c_rashi = (client.rashi or '').lower()
            c_dob = str(client.dob or '')

            # Check individual query terms
            if name_param and name_param.lower() in c_name:
                matched_fields.append('name')
                score += 80
            if phone_param and (phone_param in c_phone or phone_param in (client.alternate_phone or '')):
                matched_fields.append('phone')
                score += 90
            if dob_param and dob_param == c_dob:
                matched_fields.append('dob')
                score += 70
            if birth_star_param and (birth_star_param.lower() in c_star or birth_star_param.split('(')[0].strip().lower() in c_star):
                matched_fields.append('birth_star')
                score += 60
            if rashi_param and (rashi_param.lower() in c_rashi or rashi_param.split('(')[0].strip().lower() in c_rashi):
                matched_fields.append('rashi')
                score += 50
            if birth_place_param and birth_place_param.lower() in c_place:
                matched_fields.append('birth_place')
                score += 40

            # Universal q matching
            if search_term:
                if search_term == c_name:
                    matched_fields.append('name')
                    score += 100
                elif c_name.startswith(search_term):
                    matched_fields.append('name')
                    score += 60
                elif search_term in c_name:
                    matched_fields.append('name')
                    score += 40

                if search_term in c_phone or search_term in (client.alternate_phone or ''):
                    matched_fields.append('phone')
                    score += 90

                if search_term == c_code or search_term in c_code:
                    matched_fields.append('client_code')
                    score += 80

                if search_term in c_star:
                    matched_fields.append('birth_star')
                    score += 50

                if search_term in c_rashi:
                    matched_fields.append('rashi')
                    score += 40

                if search_term in c_place:
                    matched_fields.append('birth_place')
                    score += 30

                if search_term == c_dob:
                    matched_fields.append('dob')
                    score += 60

            client.matched_fields = list(set(matched_fields))
            client.relevance_score = score
            results.append(client)

        # Sort results: highest relevance score first, then recency of update
        results.sort(key=lambda c: (getattr(c, 'relevance_score', 0), c.updated_at), reverse=True)

        serializer = self.get_serializer(results[:50], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='check-duplicates')
    def check_duplicates(self, request):
        """
        Duplicate & Similarity Detection:
        Evaluates candidate client data against the authenticated astrologer's active records.
        Returns sorted potential matches with confidence scores, levels, matched fields, and reasons.
        """
        from .similarity import detect_client_duplicates

        candidate_data = request.data or {}
        exclude_id = candidate_data.get('exclude_client_id')

        # Fast return if all key fields are blank
        has_criteria = any([
            candidate_data.get('name'),
            candidate_data.get('phone'),
            candidate_data.get('alternate_phone'),
            candidate_data.get('dob'),
            candidate_data.get('birth_star'),
        ])
        if not has_criteria:
            return Response({'total_potential_duplicates': 0, 'matches': []}, status=status.HTTP_200_OK)

        existing_clients = list(self.get_queryset())
        matches = detect_client_duplicates(
            candidate_data=candidate_data,
            existing_clients=existing_clients,
            exclude_id=exclude_id,
            min_confidence_threshold=35
        )

        formatted_matches = []
        for m in matches[:10]:
            client_data = self.get_serializer(m['client']).data
            formatted_matches.append({
                'client': client_data,
                'confidence_score': m['confidence_score'],
                'confidence_level': m['confidence_level'],
                'matched_fields': m['matched_fields'],
                'match_reasons': m['match_reasons']
            })

        return Response({
            'total_potential_duplicates': len(formatted_matches),
            'matches': formatted_matches
        }, status=status.HTTP_200_OK)

