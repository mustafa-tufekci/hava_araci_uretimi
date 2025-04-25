#!/bin/sh
python manage.py collectstatic --noinput
pip install gunicorn
export C_FORCE_ROOT="true"

uvicorn hava_araci_uretimi.asgi:application --host 0.0.0.0 --port 8000 --workers 16 --lifespan off  --reload &
#gunicorn --bind 0.0.0.0:8000 --workers 8 --log-file /tmp/tmp.log --access-logfile /tmp/access.log --log-level debug --reload webapp.wsgi:application
tail -f /dev/null
