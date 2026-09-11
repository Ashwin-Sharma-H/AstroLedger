import re
from rest_framework import serializers
from .models import Client

def _sanitize_text(text: str) -> str:
    if not text:
        return text
    # Strip script, iframe, embed, object tags
    cleaned = re.sub(r'<\s*script[^>]*>.*?<\s*/\s*script\s*>', '', text, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r'<\s*(iframe|object|embed)[^>]*>.*?<\s*/\s*\1\s*>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    return cleaned.strip()

def _validate_phone_number(phone: str) -> str:
    stripped = phone.strip()
    if not stripped:
        return ""
    # Allow optional leading +, digits, spaces, parentheses, hyphens
    if not re.match(r'^\+?[\d\s\-\(\)]{7,25}$', stripped):
        raise serializers.ValidationError("Invalid phone number format. Please provide a valid phone number.")
    # Ensure there are at least 7 actual numeric digits
    digits_only = re.sub(r'\D', '', stripped)
    if len(digits_only) < 7:
        raise serializers.ValidationError("Phone number must contain at least 7 digits.")
    return stripped

class ClientSerializer(serializers.ModelSerializer):
    visit_count = serializers.IntegerField(read_only=True, default=0)
    first_consultation_date = serializers.DateField(read_only=True, default=None)
    last_consultation_date = serializers.DateField(read_only=True, default=None)
    matched_fields = serializers.ListField(child=serializers.CharField(), read_only=True, required=False, default=list)
    relevance_score = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Client
        fields = (
            'id', 'client_code', 'name', 'phone', 'alternate_phone',
            'email', 'gender', 'address', 'dob', 'birth_time',
            'birth_place', 'birth_star', 'rashi', 'notes',
            'extra_attributes', 'version', 'is_deleted',
            'visit_count', 'first_consultation_date', 'last_consultation_date',
            'matched_fields', 'relevance_score',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'client_code', 'created_at', 'updated_at')

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        # Convert empty strings to None for date and time fields to prevent 400 Bad Request
        if 'dob' in data and not data['dob']:
            data['dob'] = None
        if 'birth_time' in data and not data['birth_time']:
            data['birth_time'] = None
        return super().to_internal_value(data)

    def validate_name(self, value):
        cleaned = _sanitize_text(value)
        if not cleaned:
            raise serializers.ValidationError("Client name cannot be blank.")
        return cleaned

    def validate_phone(self, value):
        return _validate_phone_number(value)

    def validate_alternate_phone(self, value):
        return _validate_phone_number(value)

    def validate_notes(self, value):
        return _sanitize_text(value)

    def validate_address(self, value):
        return _sanitize_text(value)

    def validate_birth_place(self, value):
        return _sanitize_text(value)

    def validate_email(self, value):
        if value:
            return value.strip().lower()
        return value
