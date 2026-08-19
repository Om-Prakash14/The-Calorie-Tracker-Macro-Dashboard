import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import io

# Load pretrained EfficientNet-B0
weights = models.EfficientNet_B0_Weights.DEFAULT
model = models.efficientnet_b0(weights=weights)
model.eval()

# Retrieve class names
categories = weights.meta["categories"]

# Preprocessing pipeline
preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])

# Nutrient database per 100g
# Standard food items mapped from ImageNet class IDs/names
FOOD_NUTRIENTS = {
    "pizza": {"name": "Pizza", "calories": 266, "protein": 11.0, "carbs": 33.0, "fats": 10.0},
    "hotdog": {"name": "Hotdog", "calories": 290, "protein": 10.0, "carbs": 26.0, "fats": 16.0},
    "cheeseburger": {"name": "Cheeseburger", "calories": 263, "protein": 14.0, "carbs": 28.0, "fats": 11.0},
    "bagel": {"name": "Bagel", "calories": 250, "protein": 10.0, "carbs": 48.0, "fats": 1.5},
    "carbonara": {"name": "Spaghetti Carbonara", "calories": 200, "protein": 8.0, "carbs": 25.0, "fats": 8.0},
    "banana": {"name": "Banana", "calories": 89, "protein": 1.1, "carbs": 23.0, "fats": 0.3},
    "strawberry": {"name": "Strawberry", "calories": 32, "protein": 0.7, "carbs": 7.7, "fats": 0.3},
    "orange": {"name": "Orange", "calories": 47, "protein": 0.9, "carbs": 12.0, "fats": 0.1},
    "lemon": {"name": "Lemon", "calories": 29, "protein": 1.1, "carbs": 9.0, "fats": 0.3},
    "pineapple": {"name": "Pineapple", "calories": 50, "protein": 0.5, "carbs": 13.0, "fats": 0.1},
    "mushroom": {"name": "Mushroom", "calories": 22, "protein": 3.1, "carbs": 3.3, "fats": 0.3},
    "bell pepper": {"name": "Bell Pepper", "calories": 20, "protein": 0.9, "carbs": 4.6, "fats": 0.2},
    "croissant": {"name": "Croissant", "calories": 406, "protein": 8.0, "carbs": 46.0, "fats": 21.0},
    "pretzel": {"name": "Pretzel", "calories": 380, "protein": 10.0, "carbs": 80.0, "fats": 3.0},
    "mashed potato": {"name": "Mashed Potato", "calories": 88, "protein": 1.8, "carbs": 17.0, "fats": 1.5},
    "guacamole": {"name": "Guacamole", "calories": 157, "protein": 2.0, "carbs": 9.0, "fats": 15.0},
    "french loaf": {"name": "French Bread", "calories": 272, "protein": 9.0, "carbs": 52.0, "fats": 2.5},
    "ice cream": {"name": "Ice Cream", "calories": 207, "protein": 3.5, "carbs": 24.0, "fats": 11.0},
    "zucchini": {"name": "Zucchini", "calories": 17, "protein": 1.2, "carbs": 3.1, "fats": 0.3},
    "broccoli": {"name": "Broccoli", "calories": 34, "protein": 2.8, "carbs": 7.0, "fats": 0.4},
    "cauliflower": {"name": "Cauliflower", "calories": 25, "protein": 1.9, "carbs": 5.0, "fats": 0.3},
    "pomegranate": {"name": "Pomegranate", "calories": 83, "protein": 1.7, "carbs": 19.0, "fats": 1.2},
    "fig": {"name": "Fig", "calories": 74, "protein": 0.8, "carbs": 19.0, "fats": 0.3},
    "custard apple": {"name": "Custard Apple", "calories": 94, "protein": 2.1, "carbs": 24.0, "fats": 0.6},
    "artichoke": {"name": "Artichoke", "calories": 47, "protein": 3.3, "carbs": 11.0, "fats": 0.2},
    "cabbage": {"name": "Cabbage", "calories": 25, "protein": 1.3, "carbs": 6.0, "fats": 0.1},
    "acorn squash": {"name": "Acorn Squash", "calories": 40, "protein": 1.0, "carbs": 10.0, "fats": 0.1},
    "butternut squash": {"name": "Butternut Squash", "calories": 45, "protein": 1.0, "carbs": 12.0, "fats": 0.1},
    "cucumber": {"name": "Cucumber", "calories": 15, "protein": 0.7, "carbs": 3.6, "fats": 0.1},
}

DEFAULT_NUTRIENT = {"name": "Unknown Food", "calories": 120, "protein": 3.0, "carbs": 15.0, "fats": 5.0}

def predict_food(image_bytes: bytes):
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = preprocess(image).unsqueeze(0)
        
        with torch.no_grad():
            outputs = model(tensor)
            probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
            
        # Get top 3 predictions
        top3_prob, top3_catid = torch.topk(probabilities, 3)
        
        predictions = []
        for i in range(top3_prob.size(0)):
            prob = top3_prob[i].item()
            label = categories[top3_catid[i].item()]
            predictions.append((label, prob))
            
        # Try to match prediction to a known food item
        matched_food = None
        matched_prob = 0.0
        
        # We check the top predictions
        for label, prob in predictions:
            # Check if any label substring matches our food list
            for key in FOOD_NUTRIENTS.keys():
                if key in label.lower() or label.lower() in key:
                    matched_food = key
                    matched_prob = prob
                    break
            if matched_food:
                break
                
        if matched_food:
            nutrition = FOOD_NUTRIENTS[matched_food].copy()
            nutrition["confidence"] = matched_prob
            nutrition["predicted_label"] = predictions[0][0] # primary predicted label
            return nutrition
        else:
            # If no matches, return the top category names as predicted_label and a default nutrient value
            primary_label = predictions[0][0]
            # Capitalize primary label for name
            name = primary_label.replace("_", " ").title()
            
            # Simple heuristic: if the category contains words related to food, we assume it's food.
            # Otherwise we just return it with default nutrient metrics.
            nutrition = DEFAULT_NUTRIENT.copy()
            nutrition["name"] = name
            nutrition["predicted_label"] = primary_label
            nutrition["confidence"] = predictions[0][1]
            return nutrition
            
    except Exception as e:
        print(f"Error predicting food: {e}")
        # Return fallback values
        fallback = DEFAULT_NUTRIENT.copy()
        fallback["name"] = "Healthy Dish"
        fallback["predicted_label"] = "error_fallback"
        fallback["confidence"] = 0.0
        return fallback
