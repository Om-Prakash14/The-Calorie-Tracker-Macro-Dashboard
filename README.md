# FitMacro AI

An AI-powered calorie tracker and macro dashboard with a standalone Streamlit app, a Django authentication API, and a FastAPI + EfficientNet image recognition service.

## Project Structure
- `streamlit_app.py`: deployable Streamlit dashboard entry point
- `backend/`: Django Auth REST API (`http://127.0.0.1:8000`)
- `ml_backend/`: FastAPI + PyTorch EfficientNet B0 classification endpoint (`http://127.0.0.1:8001`)
- `frontend/`: original browser dashboard application

## Running the Application

### Run Streamlit locally

Ensure you have Python 3 installed, then run:
```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

The dashboard stores meals in the current Streamlit session. Image scanning loads the existing EfficientNet model only when an image is analyzed and may download pretrained weights on first use.

### Deploy on Streamlit Community Cloud

1. Push this repository to GitHub.
2. In Streamlit Community Cloud, choose **New app** and select `Om-Prakash14/The-Calorie-Tracker-Macro-Dashboard`.
3. Set the branch to `main` and the main file to `streamlit_app.py`.
4. Deploy. Streamlit Cloud installs the packages in `requirements.txt` automatically.

The Django and FastAPI services are separate local/prototype services; the Streamlit app does not require them to run.

### Run the original services

Install the dependencies from the repository root first, then start the Django Auth Server:
In the `backend` directory:
```bash
python manage.py runserver
```

### Run the FastAPI ML Server
In the `ml_backend` directory:
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```
*(On first run, the pre-trained EfficientNet weights will be automatically downloaded.)*

### Open the original frontend
Simply open `frontend/html/index.html` in any web browser. Use the default credentials:
- **Username:** `admin`
- **Password:** `adminpass`
