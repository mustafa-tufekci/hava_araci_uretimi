FROM python:3.12-bookworm

# Set environment variables
ENV TZ=Europe/Istanbul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /workspace
COPY . /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --upgrade pip 
RUN pip install --upgrade setuptools
RUN pip install -r requirements.txt
# RUN pip install --no-cache-dir -r requirements.txt

ADD . /workspace/