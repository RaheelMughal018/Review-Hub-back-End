from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from transformers import BertTokenizer, TFBertModel
import numpy as np
import tensorflow as tf
import google.generativeai as genai
from google.generativeai.types.generation_types import StopCandidateException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Configure Generative AI model
genai.configure(api_key="AIzaSyAmyL5DDKnIEmamkf6NcoBW-lI0PIRaPQg")  # Replace with your actual API key

# Load the BERT model
bert_model = TFBertModel.from_pretrained('bert-base-multilingual-cased')

generation_config = {
    "temperature": 0.9,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 5000,
}
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

model = genai.GenerativeModel(
    model_name="gemini-1.0-pro", generation_config=generation_config, safety_settings=safety_settings
)

# Define your BERT model architecture
class BERTForClassification(tf.keras.Model):
    def __init__(self, bert_model, num_classes):
        super().__init__()
        self.bert = bert_model
        self.fc = tf.keras.layers.Dense(num_classes, activation='softmax')

    def call(self, inputs, attention_mask=None, token_type_ids=None):
        outputs = self.bert(inputs, attention_mask=attention_mask, token_type_ids=token_type_ids)
        pooled_output = outputs[1]  # Assuming BERT returns pooled output in position 1
        return self.fc(pooled_output)

# Load the weights for your BERT model
bert_classifier_model = BERTForClassification(bert_model, num_classes=5)
bert_classifier_model.load_weights('Model_Weights/Model_Weights')

# Create an instance of the BERT tokenizer
tokenizer = BertTokenizer.from_pretrained('bert-base-multilingual-cased')

# Function to generate response for a given prompt
def generate_summary(prompt):
    try:
        convo = model.start_chat(history=[])
        convo.send_message([prompt])
        summary = convo.last.text
        return summary
    except StopCandidateException as e:
        print("Model couldn't generate a summary for the prompt:", prompt)
        return None

# Define request and response models
class CommentRequest(BaseModel):
    comments: list[str]

class RecommendationComment(BaseModel):
    comment: str
    annotation: str
    label: int

class SummaryRequest(BaseModel):
    recommendation_comments: list[RecommendationComment]

# Enable CORS
origins = ["*"]  # You can specify the allowed origins here
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Define route to accept JSON file of comments and return annotated comments as a JSON file
@app.post("/annotate_comments_json/")
async def annotate_comments_json(request: CommentRequest) -> JSONResponse:
    comments = request.comments

    # Tokenize and preprocess the new data
    inputs = tokenizer(comments, padding=True, truncation=True, return_tensors='tf')
    input_ids = inputs['input_ids']
    attention_mask = inputs['attention_mask']
    token_type_ids = inputs['token_type_ids']

    # Make predictions
    predictions = bert_classifier_model.predict({'input_ids': input_ids, 'attention_mask': attention_mask, 'token_type_ids': token_type_ids})

    # Convert predictions to numpy array
    predictions_array = np.array(predictions)

    # Get the index of the class with the highest probability for each prediction
    dominating_classes_index = np.argmax(predictions_array, axis=1)

    # Define the classes corresponding to the indices
    classes = ['Positive', 'Negative', 'Neutral', 'Recommendation', 'Question']

    # Define labels for each class
    labels = {'Positive': 0, 'Negative': 1, 'Neutral': 2, 'Recommendation': 3, 'Question': 4}

    # Get the dominating class for each prediction
    dominating_classes = [classes[idx] for idx in dominating_classes_index]

    # Get labels for each dominating class
    dominating_labels = [labels[cls] for cls in dominating_classes]

    # Combine comments with their annotations and labels
    annotated_comments = [{"comment": comment, "annotation": annotation, "label": label} for comment, annotation, label in zip(comments, dominating_classes, dominating_labels)]

    # Convert annotated comments to JSON format
    return JSONResponse(content=annotated_comments, status_code=200)

# Define route to receive recommendation comments and return summary
@app.post("/recommendation_summary/")
async def recommendation_summary(request: SummaryRequest):
    recommendation_comments = request.recommendation_comments
    print(recommendation_comments, " here 12pxxx")
    
    # Construct prompt by concatenating all recommendation comments
    prompt = 'Generate summary of the Following Text in One Paragraph :\n'
    for comment in recommendation_comments:
        prompt += f"- {comment.comment}\n"

    summary = generate_summary(prompt)
    if summary:
        return JSONResponse(content={"summary": summary}, status_code=200)
    else:
        raise HTTPException(status_code=500 , detail="Failed to generate summary")
