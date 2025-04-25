from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
import uuid


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, editable=False, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, editable=False, null=True, blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='%(app_label)s_%(class)s_updated_by', null=True, blank=True, on_delete=models.SET_NULL)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='%(app_label)s_%(class)s_created_by', null=True, blank=True, on_delete=models.SET_NULL)
    is_deleted = models.BooleanField(default=False, null=True, blank=True)
    is_active = models.BooleanField(default=True, null=True, blank=True)

    class Meta:
        abstract = True


class Takim(BaseModel):
    """Üretim veya montaj yapan takımları temsil eder."""
    TAKIM_TIPLERI = [
        ('KANAT', 'Kanat Takımı'),
        ('GOVDE', 'Gövde Takımı'),
        ('KUYRUK', 'Kuyruk Takımı'),
        ('AVIYONIK', 'Aviyonik Takımı'),
        ('MONTAJ', 'Montaj Takımı'),
    ]
    
    id = models.AutoField(primary_key=True)
    ad = models.CharField(max_length=100, verbose_name="Takım Adı")
    tip = models.CharField(max_length=20, choices=TAKIM_TIPLERI, verbose_name="Takım Tipi")
    aciklama = models.TextField(blank=True, null=True, verbose_name="Açıklama")

    class Meta:
        verbose_name = "Takım"
        verbose_name_plural = "Takımlar"
        ordering = ['ad']

    def __str__(self):
        return f"{self.ad} ({self.get_tip_display()})"

    def clean(self):
        super().clean()
        # Takım tipi kontrolü
        if self.tip not in dict(self.TAKIM_TIPLERI):
            raise ValidationError("Geçersiz takım tipi.")


class Personel(AbstractUser, BaseModel):
    """Sistem kullanıcılarını ve personeli temsil eder."""
    takim = models.ForeignKey(
        Takim,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='personeller',
        verbose_name="Takım"
    )
    
    class Meta:
        verbose_name = "Personel"
        verbose_name_plural = "Personeller"
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.get_full_name()} ({self.username})"

    def clean(self):
        super().clean()
        # Takım kontrolü
        if self.takim and not self.takim.is_active:
            raise ValidationError("Seçilen takım aktif değil.")


class UcakModeli(BaseModel):
    """Uçak modellerini temsil eder."""
    MODEL_TIPLERI = [
        ('TB2', 'TB2'),
        ('TB3', 'TB3'),
        ('AKINCI', 'AKINCI'),
        ('KIZILELMA', 'KIZILELMA'),
    ]
    
    model = models.CharField(
        max_length=20, 
        choices=MODEL_TIPLERI, 
        unique=True,
        verbose_name="Model"
    )
    aciklama = models.TextField(blank=True, verbose_name="Açıklama")

    class Meta:
        verbose_name = "Uçak Modeli"
        verbose_name_plural = "Uçak Modelleri"
        ordering = ['model']

    def __str__(self):
        return self.get_model_display()


class Parca(BaseModel):
    """Uçak parçalarını temsil eder."""
    PARCA_TIPLERI = [
        ('KANAT', 'Kanat'),
        ('GOVDE', 'Gövde'),
        ('KUYRUK', 'Kuyruk'),
        ('AVIYONIK', 'Aviyonik'),
    ]
    
    seri_no = models.UUIDField(
        default=uuid.uuid4, 
        editable=False, 
        unique=True,
        verbose_name="Seri Numarası"
    )
    tip = models.CharField(
        max_length=20, 
        choices=PARCA_TIPLERI,
        verbose_name="Parça Tipi"
    )
    ucak_modeli = models.ForeignKey(
        UcakModeli, 
        on_delete=models.CASCADE, 
        related_name='parcalar',
        verbose_name="Uçak Modeli"
    )
    uretim_takimi = models.ForeignKey(
        Takim, 
        on_delete=models.CASCADE, 
        related_name='uretilen_parcalar',
        verbose_name="Üretim Takımı"
    )
    uretim_tarihi = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Üretim Tarihi"
    )
    kullanildi = models.BooleanField(
        default=False,
        verbose_name="Kullanıldı"
    )
    kullanildigi_ucak = models.ForeignKey(
        'Ucak', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='kullanilan_parcalar',
        verbose_name="Kullanıldığı Uçak"
    )

    class Meta:
        verbose_name = "Parça"
        verbose_name_plural = "Parçalar"
        ordering = ['-uretim_tarihi']

    def clean(self):
        super().clean()
        if self.uretim_takimi.tip != self.tip and self.uretim_takimi.tip != 'MONTAJ':
            raise ValidationError(
                f"{self.uretim_takimi.ad} takımı {self.get_tip_display()} üretemez. "
                f"Sadece {self.uretim_takimi.get_tip_display()} üretebilir."
            )

    def __str__(self):
        return f"{self.get_tip_display()} - {self.ucak_modeli.get_model_display()} ({self.seri_no})"


class Ucak(BaseModel):
    """Uçak modeli için model."""
    seri_no = models.UUIDField(
        default=uuid.uuid4, 
        editable=False, 
        unique=True,
        verbose_name="Seri Numarası"
    )
    model = models.ForeignKey(
        UcakModeli, 
        on_delete=models.CASCADE, 
        related_name='ucaklar',
        verbose_name="Uçak Modeli"
    )
    montaj_takimi = models.ForeignKey(
        Takim, 
        on_delete=models.CASCADE, 
        related_name='montaj_ucaklar',
        verbose_name="Montaj Takımı"
    )
    montaj_tarihi = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Montaj Tarihi"
    )
    durum = models.CharField(
        max_length=20, 
        choices=[
            ('MONTAJ_YAPILDI', 'Montaj Yapıldı'),
            ('AKTIF', 'Aktif'),
            ('HURDAYA_AYRILDI', 'Hurdaya Ayrıldı'),
        ], 
        default='MONTAJ_YAPILDI',
        verbose_name="Durum"
    )
    kanat_parcasi = models.ForeignKey(
        Parca,
        on_delete=models.SET_NULL,
        null=True,
        related_name='kanat_olarak_kullanildigi_ucaklar',
        verbose_name="Kanat Parçası"
    )
    govde_parcasi = models.ForeignKey(
        Parca,
        on_delete=models.SET_NULL,
        null=True,
        related_name='govde_olarak_kullanildigi_ucaklar',
        verbose_name="Gövde Parçası"
    )
    kuyruk_parcasi = models.ForeignKey(
        Parca,
        on_delete=models.SET_NULL,
        null=True,
        related_name='kuyruk_olarak_kullanildigi_ucaklar',
        verbose_name="Kuyruk Parçası"
    )
    aviyonik_parcasi = models.ForeignKey(
        Parca,
        on_delete=models.SET_NULL,
        null=True,
        related_name='aviyonik_olarak_kullanildigi_ucaklar',
        verbose_name="Aviyonik Parçası"
    )

    class Meta:
        verbose_name = "Uçak"
        verbose_name_plural = "Uçaklar"
        ordering = ['-montaj_tarihi']

    def __str__(self):
        return f"{self.model.get_model_display()} - {self.seri_no}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new and self.durum == 'MONTAJ_EDILDI':
            # Parçaları kullanıldı olarak işaretle
            if self.kanat_parcasi:
                self.kanat_parcasi.kullanildi = True
                self.kanat_parcasi.kullanildigi_ucak = self
                self.kanat_parcasi.save()
            
            if self.govde_parcasi:
                self.govde_parcasi.kullanildi = True
                self.govde_parcasi.kullanildigi_ucak = self
                self.govde_parcasi.save()
            
            if self.kuyruk_parcasi:
                self.kuyruk_parcasi.kullanildi = True
                self.kuyruk_parcasi.kullanildigi_ucak = self
                self.kuyruk_parcasi.save()
            
            if self.aviyonik_parcasi:
                self.aviyonik_parcasi.kullanildi = True
                self.aviyonik_parcasi.kullanildigi_ucak = self
                self.aviyonik_parcasi.save()

    def get_kullanilan_parcalar(self):
        """Uçakta kullanılan parçaları döndürür."""
        return [
            self.kanat_parcasi,
            self.govde_parcasi,
            self.kuyruk_parcasi,
            self.aviyonik_parcasi
        ]

    def clean(self):
        super().clean()
        if self.montaj_takimi.tip != 'MONTAJ':
            raise ValidationError(
                f"{self.montaj_takimi.ad} takımı montaj yapamaz. "
                f"Sadece montaj takımları uçak montajı yapabilir."
            )
