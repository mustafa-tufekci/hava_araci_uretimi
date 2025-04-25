from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import viewsets, status
from django.db import transaction
from django.db.models import Q
from .models import Takim, Personel, UcakModeli, Parca, Ucak
from .serializers import (
    TakimSerializer, PersonelPostSerializer, PersonelListSerializer, UcakModeliSerializer, 
    UcakSerializer, UcakMontajSerializer, ParcaPostSerializer, ParcaListSerializer, 
    CustomTokenObtainPairSerializer
)
from .mixins import UserStampMixin
from .permissions import ReadOnlyOrSuperUser


class TakimViewSet(UserStampMixin, viewsets.ModelViewSet):
    """Takım modeli için viewset."""
    queryset = Takim.objects.filter(is_deleted=False)
    serializer_class = TakimSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['tip', 'is_active']
    search_fields = ['ad', 'tip']
    ordering_fields = '__all__'

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Apply filters from query params
        tip = self.request.query_params.get('tip')
        is_active = self.request.query_params.get('is_active')
        
        if tip:
            queryset = queryset.filter(tip=tip)
        if is_active is not None:
            is_active_bool = is_active.lower() == 'true'
            queryset = queryset.filter(is_active=is_active_bool)
        
        # Apply search if provided
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(ad__icontains=search) |
                Q(tip__icontains=search)
            )
        
        return queryset

    def perform_create(self, serializer):
        """Takım oluşturulurken kullanıcı bilgilerini ekle."""
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        """Takım güncellenirken kullanıcı bilgilerini güncelle."""
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Takımı silmek yerine is_deleted alanını true yap."""
        instance = self.get_object()
        
        # Takıma bağlı personel kontrolü
        if instance.personeller.exists():
            return Response(
                {"error": "Bu takıma bağlı personeller var. Önce personelleri başka bir takıma atayın veya silin."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Takımı silmek yerine is_deleted alanını true yap
        instance.is_deleted = True
        instance.updated_by = request.user
        instance.save()
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class PersonelViewSet(UserStampMixin, viewsets.ModelViewSet):
    queryset = Personel.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['username', 'takim']
    search_fields = ['username', 'first_name', 'last_name', 'email']
    ordering_fields = '__all__'

    def get_queryset(self):
        # Superuser tüm personeli görebilir
        if self.request.user.is_superuser:
            return Personel.objects.all()
        
        # Diğer kullanıcılar sadece kendi takımlarındaki personeli görebilir
        user_team = self.request.user.takim
        if not user_team:
            return Personel.objects.none()
            
        return Personel.objects.filter(takim=user_team)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PersonelPostSerializer
        return PersonelListSerializer

    def perform_create(self, serializer):
        """Personel oluşturulurken kullanıcı bilgilerini ekle."""
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )

    def perform_update(self, serializer):
        """Personel güncellenirken kullanıcı bilgilerini güncelle."""
        serializer.save(updated_by=self.request.user)


class UcakModeliViewSet(UserStampMixin, viewsets.ModelViewSet):
    queryset = UcakModeli.objects.all()
    serializer_class = UcakModeliSerializer
    permission_classes = [ReadOnlyOrSuperUser]
    filterset_fields = ['model']
    search_fields = ['model', 'aciklama']
    ordering_fields = '__all__'

    def create(self, request, *args, **kwargs):
        """Yeni uçak modeli oluştururken benzersizlik kontrolü yapar."""
        model = request.data.get('model')
        if UcakModeli.objects.filter(model=model).exists():
            return Response(
                {"error": f"{model} modeli zaten sistemde kayıtlı. Lütfen farklı bir model seçiniz."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Uçak modeli güncellenirken benzersizlik kontrolü yapar."""
        instance = self.get_object()
        model = request.data.get('model')
        
        # Eğer model değişmediyse güncellemeye izin ver
        if instance.model == model:
            return super().update(request, *args, **kwargs)
            
        # Model değiştiyse ve yeni model zaten varsa hata ver
        if UcakModeli.objects.filter(model=model).exists():
            return Response(
                {"error": f"{model} modeli zaten sistemde kayıtlı. Lütfen farklı bir model seçiniz."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)


class ParcaViewSet(UserStampMixin, viewsets.ModelViewSet):
    """Parça modeli için viewset."""
    queryset = Parca.objects.filter(is_deleted=False)
    permission_classes = [IsAuthenticated]
    filterset_fields = ['tip', 'ucak_modeli', 'kullanildi']
    search_fields = ['seri_no', 'tip']
    ordering_fields = '__all__'

    def get_queryset(self):
        # Get the user's team
        user_team = self.request.user.takim
        
        # Montaj takımındaki kullanıcılar tüm parçaları görebilir
        if user_team and user_team.tip == 'MONTAJ':
            queryset = Parca.objects.filter(is_deleted=False)
        else:
            # Diğer takımlar sadece kendi parçalarını görebilir
            queryset = Parca.objects.filter(uretim_takimi=user_team, is_deleted=False)
        
        # Apply filters from query params
        tip = self.request.query_params.get('tip')
        ucak_modeli = self.request.query_params.get('ucak_modeli')
        kullanildi = self.request.query_params.get('kullanildi')
        
        if tip:
            queryset = queryset.filter(tip=tip)
        if ucak_modeli:
            queryset = queryset.filter(ucak_modeli_id=ucak_modeli)
        if kullanildi is not None:
            kullanildi_bool = kullanildi.lower() == 'true'
            queryset = queryset.filter(kullanildi=kullanildi_bool)
        
        # Apply search if provided
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(seri_no__icontains=search) |
                Q(tip__icontains=search)
            )
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return ParcaPostSerializer
        return ParcaListSerializer
    
    def create(self, request, *args, **kwargs):
        """Parça oluşturma işlemini kontrol eder."""
        # Kullanıcının takımını kontrol et
        user_team = request.user.takim
        if not user_team:
            return Response(
                {"error": "Parça üretmek için bir takıma bağlı olmalısınız."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Montaj takımı kontrolü
        if user_team.tip == 'MONTAJ':
            return Response(
                {"error": "Montaj takımı üyeleri parça üretemez."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Parça oluşturulurken üretim takımını ve kullanıcı bilgilerini ekle."""
        serializer.save(
            uretim_takimi=self.request.user.takim,
            created_by=self.request.user,
            updated_by=self.request.user
        )

    def perform_update(self, serializer):
        """Parça güncellenirken üretim takımını değiştirme."""
        serializer.save(
            uretim_takimi=self.request.user.takim,
            updated_by=self.request.user
        )

    @action(detail=True, methods=['post'])
    def geri_donusum(self, request, pk=None):
        """Parçayı geri dönüşüme gönderir."""
        parca = self.get_object()
        
        # Montaj takımı kontrolü
        if request.user.takim and request.user.takim.tip == 'MONTAJ':
            return Response(
                {"error": "Montaj takımı üyeleri parça geri dönüşümü yapamaz."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if the part belongs to user's team
        if parca.uretim_takimi != request.user.takim:
            return Response(
                {"error": "Bu parçayı geri dönüşüme gönderme yetkiniz yok."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if parca.kullanildi:
            return Response(
                {"error": "Kullanılmış parçalar geri dönüşüme gönderilemez."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parçayı silmek yerine is_deleted alanını true yap
        parca.is_deleted = True
        parca.updated_by = request.user
        parca.save()
        
        return Response(status=status.HTTP_204_NO_CONTENT)

class UcakViewSet(UserStampMixin, viewsets.ModelViewSet):
    queryset = Ucak.objects.all()
    serializer_class = UcakSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['model', 'montaj_takimi', 'durum']
    search_fields = ['seri_no', 'durum']
    ordering_fields = '__all__'


    @action(detail=False, methods=['post'])
    def montaj(self, request):
        """Yeni uçak montajı yapar."""
        serializer = UcakMontajSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Kullanıcı Montaj Takımında mı kontrol et
        if not request.user.takim:
            return Response(
                {"error": "Montaj işlemi için bir takıma bağlı olmalısınız."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        if request.user.takim.tip != 'MONTAJ':
            return Response(
                {"error": "Sadece montaj takımı üyeleri montaj işlemi yapabilir."},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            # Uçağı oluştur
            ucak = Ucak.objects.create(
                model_id=serializer.validated_data['model'].id,
                montaj_takimi=serializer.validated_data['montaj_takimi'],
                durum='MONTAJ_EDILDI',
                kanat_parcasi=serializer.validated_data['kanat_parcasi'],
                govde_parcasi=serializer.validated_data['govde_parcasi'],
                kuyruk_parcasi=serializer.validated_data['kuyruk_parcasi'],
                aviyonik_parcasi=serializer.validated_data['aviyonik_parcasi'],
                created_by=request.user,
                updated_by=request.user
            )

            return Response(UcakSerializer(ucak).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def hurdaya_ayir(self, request, pk=None):
        """Uçağı hurdaya ayırır."""
        ucak = self.get_object()
        if ucak.durum == 'HURDAYA_AYRILDI':
            return Response(
                {"error": "Bu uçak zaten hurdaya ayrılmış."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            ucak.durum = 'HURDAYA_AYRILDI'
            ucak.updated_by = request.user
            ucak.save()
            
            # Parçaları kullanılmamış olarak işaretle
            Parca.objects.filter(kullanildigi_ucak=ucak).update(
                kullanildi=False,
                kullanildigi_ucak=None,
                updated_by=request.user
            )
            
            return Response(UcakSerializer(ucak).data)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
