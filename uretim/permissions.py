from rest_framework.permissions import BasePermission, SAFE_METHODS

class ReadOnlyOrSuperUser(BasePermission):
    """
    - SAFE_METHODS (GET, HEAD, OPTIONS) → Herkes (giriş yapmış olan)
    - Diğer işlemler → Sadece superuser
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_superuser