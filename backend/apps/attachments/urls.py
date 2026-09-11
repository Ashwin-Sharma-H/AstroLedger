from django.urls import path
from .views import AttachmentListView

urlpatterns = [
    path('', AttachmentListView.as_view(), name='attachment_list'),
]
