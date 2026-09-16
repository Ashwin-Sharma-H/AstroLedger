from django.urls import path
from .views import (
    SyncPushView,
    SyncPullView,
    ServerInfoView,
    DeviceListView,
    DeviceHeartbeatView,
    DeviceDisconnectView,
    GeneratePairingTicketView,
    ClaimPairingTicketView,
)

urlpatterns = [
    path('push/', SyncPushView.as_view(), name='sync_push'),
    path('pull/', SyncPullView.as_view(), name='sync_pull'),
    path('server-info/', ServerInfoView.as_view(), name='sync_server_info'),
    path('pair/generate/', GeneratePairingTicketView.as_view(), name='sync_pair_generate'),
    path('pair/claim/', ClaimPairingTicketView.as_view(), name='sync_pair_claim'),
    path('devices/', DeviceListView.as_view(), name='sync_device_list'),
    path('devices/heartbeat/', DeviceHeartbeatView.as_view(), name='sync_device_heartbeat'),
    path('devices/<str:device_id>/', DeviceDisconnectView.as_view(), name='sync_device_disconnect'),
]
