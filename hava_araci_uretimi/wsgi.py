import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hava_araci_uretimi.settings')

application = get_wsgi_application()
