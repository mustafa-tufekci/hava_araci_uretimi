from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import Takim, Personel, UcakModeli, Parca, Ucak

@admin.register(Takim)
class TakimAdmin(admin.ModelAdmin):
    list_display = ('ad', 'tip', 'created_at', 'updated_at', 'is_active')
    list_filter = ('tip', 'is_active', 'is_deleted')
    search_fields = ('ad', 'aciklama')
    readonly_fields = ('created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        (None, {
            'fields': ('ad', 'tip', 'aciklama')
        }),
        (_('Durum Bilgileri'), {
            'fields': ('is_active', 'is_deleted')
        }),
        (_('Sistem Bilgileri'), {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Personel)
class PersonelAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'takim', 'is_active', 'is_deleted')
    list_filter = ('takim', 'is_active', 'is_staff', 'is_superuser', 'is_deleted')
    search_fields = ('username', 'first_name', 'last_name', 'email')
    readonly_fields = ('created_at', 'updated_at', 'created_by', 'updated_by')
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'email')}),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
        (_('Takım Bilgisi'), {'fields': ('takim',)}),
        (_('Sistem Bilgileri'), {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'is_deleted'),
            'classes': ('collapse',)
        }),
    )

@admin.register(UcakModeli)
class UcakModeliAdmin(admin.ModelAdmin):
    list_display = ('model', 'created_at', 'updated_at', 'is_active')
    list_filter = ('is_active', 'is_deleted')
    search_fields = ('model', 'aciklama')
    readonly_fields = ('created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        (None, {
            'fields': ('model', 'aciklama')
        }),
        (_('Durum Bilgileri'), {
            'fields': ('is_active', 'is_deleted')
        }),
        (_('Sistem Bilgileri'), {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Parca)
class ParcaAdmin(admin.ModelAdmin):
    list_display = ('seri_no', 'tip', 'ucak_modeli', 'uretim_takimi', 'kullanildi', 'created_at', 'is_deleted', 'is_active')
    list_filter = ('tip', 'ucak_modeli', 'uretim_takimi', 'kullanildi', 'is_active', 'is_deleted')
    search_fields = ('seri_no',)
    readonly_fields = ('seri_no', 'created_at', 'updated_at', 'created_by', 'updated_by', 'uretim_tarihi')
    fieldsets = (
        (None, {
            'fields': ('seri_no', 'tip', 'ucak_modeli', 'uretim_takimi')
        }),
        (_('Kullanım Bilgileri'), {
            'fields': ('kullanildi', 'kullanildigi_ucak')
        }),
        (_('Durum Bilgileri'), {
            'fields': ('is_active', 'is_deleted')
        }),
        (_('Sistem Bilgileri'), {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'uretim_tarihi'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Ucak)
class UcakAdmin(admin.ModelAdmin):
    list_display = ('seri_no', 'model', 'montaj_takimi', 'durum', 'montaj_tarihi', 'created_at', 'is_active')
    list_filter = ('model', 'montaj_takimi', 'durum', 'is_active', 'is_deleted')
    search_fields = ('seri_no',)
    readonly_fields = ('seri_no', 'created_at', 'updated_at', 'created_by', 'updated_by', 'montaj_tarihi')
    fieldsets = (
        (None, {
            'fields': ('seri_no', 'model', 'montaj_takimi')
        }),
        (_('Durum Bilgileri'), {
            'fields': ('durum', 'is_active', 'is_deleted')
        }),
        (_('Sistem Bilgileri'), {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'montaj_tarihi'),
            'classes': ('collapse',)
        }),
    )
