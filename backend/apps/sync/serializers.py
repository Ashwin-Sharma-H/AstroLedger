from rest_framework import serializers
from .models import ChangeEvent, ConnectedDevice
from django.utils import timezone
from datetime import timedelta

class ChangeEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeEvent
        fields = (
            'id', 'device_id', 'entity_type', 'entity_id',
            'operation', 'version', 'idempotency_key', 'payload', 'timestamp'
        )
        read_only_fields = ('id', 'timestamp')

class PushSyncSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=100)
    events = ChangeEventSerializer(many=True)

class ConnectedDeviceSerializer(serializers.ModelSerializer):
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = ConnectedDevice
        fields = (
            'id', 'device_id', 'device_name', 'device_type',
            'ip_address', 'last_seen', 'is_online', 'is_active', 'created_at'
        )
        read_only_fields = ('id', 'last_seen', 'is_online', 'created_at')

    def get_is_online(self, obj):
        return obj.is_active and (timezone.now() - obj.last_seen) < timedelta(minutes=3)
