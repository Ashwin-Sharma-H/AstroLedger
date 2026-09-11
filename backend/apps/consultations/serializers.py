import re
from rest_framework import serializers
from .models import Consultation

def _sanitize_text(text: str) -> str:
    if not text:
        return text
    cleaned = re.sub(r'<\s*script[^>]*>.*?<\s*/\s*script\s*>', '', text, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r'<\s*(iframe|object|embed)[^>]*>.*?<\s*/\s*\1\s*>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    return cleaned.strip()

class ConsultationSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.name')
    client_code = serializers.ReadOnlyField(source='client.client_code')

    class Meta:
        model = Consultation
        fields = (
            'id', 'client', 'client_name', 'client_code',
            'consultation_date', 'consultation_time',
            'consultation_type', 'reason', 'discussion',
            'summary', 'advice', 'follow_up_required',
            'follow_up_date', 'follow_up_notes', 'follow_up_completed',
            'version', 'is_deleted', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        # Convert empty strings to None for date and time fields to prevent 400 Bad Request
        if 'follow_up_date' in data and not data['follow_up_date']:
            data['follow_up_date'] = None
        if 'consultation_time' in data and not data['consultation_time']:
            data['consultation_time'] = None
        if not data.get('follow_up_required'):
            data['follow_up_date'] = None
        return super().to_internal_value(data)

    def validate_client(self, client):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if client.user != request.user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to attach consultations to this client.")
        return client

    def validate_reason(self, value):
        return _sanitize_text(value)

    def validate_discussion(self, value):
        return _sanitize_text(value)

    def validate_summary(self, value):
        return _sanitize_text(value)

    def validate_advice(self, value):
        return _sanitize_text(value)

    def validate_follow_up_notes(self, value):
        return _sanitize_text(value)

    def validate(self, attrs):
        consultation_date = attrs.get('consultation_date')
        follow_up_date = attrs.get('follow_up_date')
        follow_up_required = attrs.get('follow_up_required', False)

        if self.instance:
            if consultation_date is None:
                consultation_date = self.instance.consultation_date
            if follow_up_date is None:
                follow_up_date = self.instance.follow_up_date

        if follow_up_required and follow_up_date and consultation_date:
            if follow_up_date < consultation_date:
                raise serializers.ValidationError({
                    'follow_up_date': "Follow-up date cannot be earlier than the consultation date."
                })

        return attrs
