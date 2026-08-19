# Quantiphi-Vibe

An AI-powered Calorie Tracker & Macro Dashboard built with a Django user authentication backend, a FastAPI + EfficientNet image recognition backend, and a modern, glassmorphic HTML/CSS/JS frontend.

## Project Structure
- `backend/`: Django Auth REST API (`http://127.0.0.1:8000`)
- `ml_backend/`: FastAPI + PyTorch EfficientNet B0 classification endpoint (`http://127.0.0.1:8001`)
- `frontend/`: Single-page client dashboard application

## Running the Application

### 1. Requirements
Ensure you have Python 3 installed. Install the backend dependencies:
```bash
cd backend
pip install -r requirements.txt
```
*(Dependencies: Django, djangorestframework, djangorestframework-simplejwt, django-cors-headers, fastapi, uvicorn, torch, torchvision, pillow, python-multipart)*

### 2. Run the Django Auth Server
In the `backend` directory:
```bash
python manage.py runserver
```

### 3. Run the FastAPI ML Server
In the `ml_backend` directory:
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```
*(On first run, the pre-trained EfficientNet weights will be automatically downloaded.)*

### 4. Open the Frontend
Simply open `frontend/html/index.html` in any web browser. Use the default credentials:
- **Username:** `admin`
- **Password:** `adminpass`
