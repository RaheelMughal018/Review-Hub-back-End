import numpy as np
import tensorflow as tf
from transformers import BertTokenizer
from transformers import TFBertModel
import csv

# Define your model architecture
class BERTForClassification(tf.keras.Model):
    def __init__(self, bert_model, num_classes):
        super().__init__()
        self.bert = bert_model
        self.fc = tf.keras.layers.Dense(num_classes, activation='softmax')

    def call(self, inputs, attention_mask=None, token_type_ids=None):
        outputs = self.bert(inputs, attention_mask=attention_mask, token_type_ids=token_type_ids)
        pooled_output = outputs[1]  # Assuming BERT returns pooled output in position 1
        return self.fc(pooled_output)

# Load the BERT model
bert_model = TFBertModel.from_pretrained('bert-base-multilingual-cased')

# Define the number of classes
NUM_CLASSES = 5  # Replace with your number of classes

# Create an instance of your model
model = BERTForClassification(bert_model, NUM_CLASSES)

# Load the weights for your model
model.load_weights('Model_Weights/Model_Weights')

# Create an instance of the BERT tokenizer
tokenizer = BertTokenizer.from_pretrained('bert-base-multilingual-cased')

# Load CSV file and label comments
def label_comments(input_file, output_file):
    # Read comments from CSV
    comments = []
    with open(input_file, 'r', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        next(reader)  # Skip header
        for row in reader:
            comments.append(row[0])  # Assuming comments are in the first column

    # Tokenize and preprocess the new data
    inputs = tokenizer(comments, padding=True, truncation=True, return_tensors='tf')
    input_ids = inputs['input_ids']
    attention_mask = inputs['attention_mask']
    token_type_ids = inputs['token_type_ids']

    # Make predictions
    predictions = model.predict({'input_ids': input_ids, 'attention_mask': attention_mask, 'token_type_ids': token_type_ids})

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
    annotated_comments = [(comment, annotation, label) for comment, annotation, label in zip(comments, dominating_classes, dominating_labels)]

    # Write annotated comments to a new CSV file
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Comment', 'Annotation', 'Label'])
        for comment, annotation, label in annotated_comments:
            writer.writerow([comment, annotation, label])

# Input and output filenames
input_file = 'long_lines.csv'  # Change this to your input CSV filename
output_file = 'annotated_comments.csv'  # Change this to your output CSV filename

# Label comments and create annotated CSV file
label_comments(input_file, output_file)
