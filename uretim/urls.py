from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    TakimViewSet, PersonelViewSet, UcakModeliViewSet,
    ParcaViewSet, UcakViewSet, CustomTokenObtainPairView
)

router = DefaultRouter()
router.register(r'takimlar', TakimViewSet)
router.register(r'personel', PersonelViewSet)
router.register(r'ucak-modelleri', UcakModeliViewSet)
router.register(r'parcalar', ParcaViewSet, basename='parca')
router.register(r'ucaklar', UcakViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
] 