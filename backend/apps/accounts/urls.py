from django.urls import path
from .views import (
    CurrentUserView,
    RegisterView,
    LogoutView,
    ChangePasswordView,
    ThrottledTokenObtainPairView,
    ThrottledTokenRefreshView,
)

urlpatterns = [
    path('login/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('me/', CurrentUserView.as_view(), name='auth_me'),
    path('change-password/', ChangePasswordView.as_view(), name='auth_change_password'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
]
