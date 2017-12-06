from django.contrib import admin

from .models import SettingsAzureOrganization


class SettingsAzureOrganizationAdmin(admin.ModelAdmin):
    list_display = ('organization', )


admin.site.register(SettingsAzureOrganization, SettingsAzureOrganizationAdmin)
