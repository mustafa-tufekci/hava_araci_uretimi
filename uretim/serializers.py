from rest_framework import serializers
from .models import Takim, Personel, UcakModeli, Parca, Ucak
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class TakimSerializer(serializers.ModelSerializer):
    """Takım modeli için serializer."""
    class Meta:
        model = Takim
        fields = ['id', 'ad', 'tip', 'aciklama', 'is_active']
        read_only_fields = ['id']
        datatables_always_serialize = ['id']

class PersonelPostSerializer(serializers.ModelSerializer):
    """Personel oluşturma ve güncelleme için serializer."""
    password = serializers.CharField(write_only=True, required=False)
    takim = serializers.PrimaryKeyRelatedField(queryset=Takim.objects.all(), required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'first_name', 'last_name', 'email', 'takim']
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            takim=validated_data['takim']
        )
        return user

    def update(self, instance, validated_data):
        if 'password' in validated_data:
            password = validated_data.pop('password')
            instance.set_password(password)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class PersonelListSerializer(serializers.ModelSerializer):
    """Personel listeleme için serializer."""
    takim = serializers.StringRelatedField()
    takim_id = serializers.PrimaryKeyRelatedField(source='takim', read_only=True)
    takim_tipi = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'takim', 'takim_tipi', 'full_name', 'takim_id']
        read_only_fields = fields
        datatables_always_serialize = ['id']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_takim_tipi(self, obj):
        """Return team type if team exists, otherwise return None."""
        return obj.takim.tip if obj.takim else None

class UcakModeliSerializer(serializers.ModelSerializer):
    """Uçak modeli için serializer."""
    class Meta:
        model = UcakModeli
        fields = ['id', 'model', 'aciklama', 'is_active']
        read_only_fields = ['id']
        datatables_always_serialize = ['id']

class ParcaPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parca
        fields = ['tip', 'ucak_modeli']

    def validate(self, data):
        # Kullanıcının takımını al
        user = self.context['request'].user
        if not user.takim:
            raise serializers.ValidationError("Kullanıcının bir takımı yok.")
        
        # Takım tipi kontrolü
        if user.takim.tip != data['tip'] and user.takim.tip != 'MONTAJ':
            raise serializers.ValidationError(
                f"{user.takim.ad} takımı {data['tip']} parçası üretemez. "
                f"Sadece {user.takim.tip} parçası üretebilir."
            )
        
        # Kullanıcının takımını üretim takımı olarak ata
        data['uretim_takimi'] = user.takim
        return data

class ParcaListSerializer(serializers.ModelSerializer):
    seri_no = serializers.CharField(read_only=True)
    tip = serializers.CharField(source='get_tip_display')
    ucak_modeli = serializers.CharField(source='ucak_modeli.model')
    uretim_takimi = serializers.CharField(source='uretim_takimi.ad')
    uretim_tarihi = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    kullanildi = serializers.BooleanField()
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Parca
        fields = ['id', 'seri_no', 'tip', 'ucak_modeli', 'uretim_takimi', 'uretim_tarihi', 'kullanildi', 'created_by']
        datatables_always_serialize = ['id']

    def get_created_by(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}"
        return "-"

class UcakSerializer(serializers.ModelSerializer):
    """Uçak modeli için serializer."""
    model = serializers.StringRelatedField(source='model.get_model_display', read_only=True)
    montaj_takimi = serializers.StringRelatedField(source='montaj_takimi.ad', read_only=True)
    kullanilan_parcalar = ParcaListSerializer(many=True, read_only=True)

    class Meta:
        model = Ucak
        fields = ['id', 'seri_no', 'model', 'montaj_takimi', 'montaj_tarihi', 
                 'durum', 'kullanilan_parcalar', 'is_active']
        read_only_fields = ['id', 'seri_no', 'montaj_tarihi']
        datatables_always_serialize = ['id', 'durum']

class UcakMontajSerializer(serializers.Serializer):
    """Uçak montajı için özel serializer."""
    model = serializers.PrimaryKeyRelatedField(queryset=UcakModeli.objects.all())
    kanat_parcasi = serializers.PrimaryKeyRelatedField(
        queryset=Parca.objects.filter(kullanildi=False, is_deleted=False, tip='KANAT'),
        required=True
    )
    govde_parcasi = serializers.PrimaryKeyRelatedField(
        queryset=Parca.objects.filter(kullanildi=False, is_deleted=False, tip='GOVDE'),
        required=True
    )
    kuyruk_parcasi = serializers.PrimaryKeyRelatedField(
        queryset=Parca.objects.filter(kullanildi=False, is_deleted=False, tip='KUYRUK'),
        required=True
    )
    aviyonik_parcasi = serializers.PrimaryKeyRelatedField(
        queryset=Parca.objects.filter(kullanildi=False, is_deleted=False, tip='AVIYONIK'),
        required=True
    )

    def validate(self, data):
        """Montaj için parça kontrolü yapar."""
        model = data['model']
        user = self.context['request'].user
        
        # Kullanıcının takımını kontrol et
        if not user.takim:
            raise serializers.ValidationError(
                "Montaj işlemi için bir takıma bağlı olmalısınız."
            )
        
        # Montaj takımı kontrolü
        if user.takim.tip != 'MONTAJ':
            raise serializers.ValidationError(
                "Sadece montaj takımları uçak montajı yapabilir."
            )
        
        # Parçaların uçak modeline uygunluğunu kontrol et
        parcalar = [
            data['kanat_parcasi'],
            data['govde_parcasi'],
            data['kuyruk_parcasi'],
            data['aviyonik_parcasi']
        ]
        
        for parca in parcalar:
            if parca.ucak_modeli_id != model.id:
                raise serializers.ValidationError(
                    f"{parca.get_tip_display()} parçası {model.model} modeline ait değil."
                )
        
        # Stok kontrolü
        for tip in ['KANAT', 'GOVDE', 'KUYRUK', 'AVIYONIK']:
            stok = Parca.objects.filter(
                tip=tip,
                ucak_modeli_id=model.id,
                kullanildi=False,
                is_deleted=False
            ).count()
            
            if stok < 1:
                raise serializers.ValidationError(
                    f"{model.model} için {tip} parçası stokta yok."
                )
        
        # Montaj takımını data'ya ekle
        data['montaj_takimi'] = user.takim
        return data

class TokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = PersonelListSerializer()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # Token bilgilerini al
        refresh = self.get_token(self.user)
        data['refresh'] = str(refresh)
        data['access'] = str(refresh.access_token)
        
        # Kullanıcı bilgilerini ekle
        user_data = PersonelListSerializer(self.user).data
        user_data['is_superuser'] = self.user.is_superuser
        data['user'] = user_data
        
        return data 