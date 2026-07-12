from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import tensorflow as tf
import io
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "allow_headers": "*", "methods": "*"}})

# Load trained model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model = tf.keras.models.load_model(
    os.path.join(BASE_DIR, "model", "food_classifier_tfdata.h5")
)

IMG_SIZE = 150

class_names = [
    'burger',
    'chicken_curry',
    'donuts',
    'french_fries',
    'pasta',
    'pizza'
]

class_names1 = {
    'pizza': 'PIZZA',
    'burger': 'BURGER',
    'chicken_curry': 'CHICKEN CURRY',
    'french_fries': 'FRENCH FRIES',
    'donuts': 'DONUT',
    'pasta': 'PASTA'
}


@app.route("/")
def home():
    return "Food Detection Backend Running"


@app.route("/predict", methods=["POST"])
def predict():

    if "image" not in request.files:
        return jsonify({
            "error": "No image uploaded"
        }), 400

    try:
        file = request.files["image"]

        # Read image
        img = Image.open(
            io.BytesIO(file.read())
        ).convert("RGB")

        # Center-crop to square (preserve aspect ratio)
        width, height = img.size
        min_dim = min(width, height)
        left = (width - min_dim) / 2
        top = (height - min_dim) / 2
        right = (width + min_dim) / 2
        bottom = (height + min_dim) / 2
        img = img.crop((left, top, right, bottom))

        # Resize image
        img = img.resize(
            (IMG_SIZE, IMG_SIZE)
        )

        # Convert image to numpy array
        img_array = np.array(img)

        # Add batch dimension
        img_array = np.expand_dims(
            img_array,
            axis=0
        )

        # Predict
        predictions = model.predict(
            img_array,
            verbose=0
        )

        # Get predicted class
        predicted_index = np.argmax(
            predictions
        )

        original_class = class_names[
            predicted_index
        ]

        predicted_class = class_names1[
            original_class
        ]

        # Confidence
        confidence = float(
            np.max(predictions) * 100
        )

        return jsonify({
            "food": predicted_class,
            "confidence": round(
                confidence,
                2
            )
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500



if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)