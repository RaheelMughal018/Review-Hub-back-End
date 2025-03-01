from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()

# Allow requests from your React application's origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your specific origin or set it to ["*"] to allow all origins
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)

def send_data_to_nodejs(data):
    try:
        response = requests.post("http://localhost:3000/api/receive_json", json=data)
        response.raise_for_status()  # Raise an exception for HTTP errors
        return {"message": "JSON data sent successfully to Node.js server"}
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to send JSON data: {str(e)}")

@app.post("/scraper")
async def scraper(data: dict):
    if data:
        return send_data_to_nodejs(data)
    else:
        raise HTTPException(status_code=400, detail="No JSON data provided")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
