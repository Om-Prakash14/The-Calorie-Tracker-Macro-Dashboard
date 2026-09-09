from datetime import datetime

import streamlit as st


st.set_page_config(
    page_title="FitMacro AI",
    page_icon="🔥",
    layout="wide",
    initial_sidebar_state="expanded",
)

GOALS = {
    "Weight loss": {"calories": 1600, "protein": 120, "carbs": 160, "fats": 53},
    "Maintenance": {"calories": 2000, "protein": 100, "carbs": 250, "fats": 67},
    "Muscle gain": {"calories": 2500, "protein": 150, "carbs": 300, "fats": 78},
}

FOOD_DATABASE = [
    {"name": "Pizza", "calories": 266, "protein": 11, "carbs": 33, "fats": 10},
    {"name": "Cheeseburger", "calories": 263, "protein": 14, "carbs": 28, "fats": 11},
    {"name": "Banana", "calories": 89, "protein": 1.1, "carbs": 23, "fats": 0.3},
    {"name": "Chicken Breast", "calories": 165, "protein": 31, "carbs": 0, "fats": 3.6},
    {"name": "Oatmeal", "calories": 389, "protein": 16.9, "carbs": 66, "fats": 6.9},
    {"name": "Brown Rice", "calories": 111, "protein": 2.6, "carbs": 23, "fats": 0.9},
    {"name": "Egg", "calories": 155, "protein": 13, "carbs": 1.1, "fats": 11},
    {"name": "Salmon", "calories": 208, "protein": 20, "carbs": 0, "fats": 13},
    {"name": "Broccoli", "calories": 34, "protein": 2.8, "carbs": 7, "fats": 0.4},
    {"name": "Ice Cream", "calories": 207, "protein": 3.5, "carbs": 24, "fats": 11},
]


def initialize_state():
    st.session_state.setdefault("goal", "Weight loss")
    st.session_state.setdefault("meals", [])
    st.session_state.setdefault("food_catalog", FOOD_DATABASE.copy())
    st.session_state.setdefault("food_selector", FOOD_DATABASE[0]["name"])
    st.session_state.setdefault("pending_food_selector", None)
    st.session_state.setdefault("scan_result", None)


def totals():
    return {
        key: sum(float(meal[key]) for meal in st.session_state.meals)
        for key in ("calories", "protein", "carbs", "fats")
    }


def scaled_nutrients(food, portion):
    factor = portion / 100
    return {
        key: round(float(food[key]) * factor, 1 if key != "calories" else 0)
        for key in ("calories", "protein", "carbs", "fats")
    }


def scan_image(uploaded_file):
    try:
        from ml_backend.model import predict_food

        result = predict_food(uploaded_file.getvalue())
        return result, None
    except Exception as error:
        return None, str(error)


def select_scanned_food(result):
    catalog = st.session_state.food_catalog
    predicted_name = result["name"].strip()
    matching_food = next(
        (
            food
            for food in catalog
            if food["name"].casefold() == predicted_name.casefold()
            or food["name"].casefold() in predicted_name.casefold()
            or predicted_name.casefold() in food["name"].casefold()
        ),
        None,
    )
    if matching_food is None:
        matching_food = {
            "name": predicted_name,
            "calories": result["calories"],
            "protein": result["protein"],
            "carbs": result["carbs"],
            "fats": result["fats"],
        }
        catalog.append(matching_food)
    st.session_state.pending_food_selector = matching_food["name"]


initialize_state()

if st.session_state.pending_food_selector:
    st.session_state.food_selector = st.session_state.pending_food_selector
    st.session_state.pending_food_selector = None

st.markdown(
    """
    <style>
    .block-container { max-width: 1200px; padding-top: 2rem; }
    [data-testid="stMetricValue"] { color: #f97316; }
    .calorie-progress-track {
        width: 100%;
        height: 18px;
        margin: 0.75rem 0 0.35rem;
        overflow: hidden;
        border-radius: 999px;
        background: #252936;
    }
    .calorie-progress-fill {
        height: 100%;
        border-radius: inherit;
        transition: width 220ms ease, background-color 220ms ease;
    }
    .calorie-progress-label {
        color: #a8acb8;
        font-size: 0.9rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("🔥 FitMacro AI")
st.caption("A focused calorie and macro tracker for everyday decisions.")

with st.sidebar:
    st.header("Daily setup")
    st.session_state.goal = st.selectbox(
        "Fitness goal", list(GOALS), index=list(GOALS).index(st.session_state.goal)
    )
    goal = GOALS[st.session_state.goal]
    st.divider()
    st.subheader("Add a meal")
    food_names = [food["name"] for food in st.session_state.food_catalog]
    st.selectbox("Food", food_names, key="food_selector")
    selected_food = next(
        food
        for food in st.session_state.food_catalog
        if food["name"] == st.session_state.food_selector
    )
    portion = st.number_input("Portion (g)", min_value=1, value=100, step=10)
    nutrients = scaled_nutrients(selected_food, portion)
    st.caption(
        f"{nutrients['calories']:.0f} kcal · {nutrients['protein']:.1f}g protein · "
        f"{nutrients['carbs']:.1f}g carbs · {nutrients['fats']:.1f}g fat"
    )
    if st.button("Log meal", type="primary", use_container_width=True):
        st.session_state.meals.append(
            {
                "time": datetime.now().strftime("%I:%M %p"),
                "name": selected_food["name"],
                "portion": portion,
                **nutrients,
            }
        )
        st.rerun()

    st.divider()
    st.subheader("AI food scanner")
    uploaded_file = st.file_uploader("Upload a food image", type=["jpg", "jpeg", "png"])
    if uploaded_file and st.button("Analyze image", use_container_width=True):
        with st.spinner("Analyzing image..."):
            result, error = scan_image(uploaded_file)
        if result:
            st.session_state.scan_result = result
            select_scanned_food(result)
            st.success(f"Identified {result['name']}")
            st.rerun()
        else:
            st.error(f"Scanner unavailable: {error}")
    if st.session_state.scan_result:
        result = st.session_state.scan_result
        st.info(
            f"{result['name']} · {result['calories']} kcal/100g · "
            f"{result['confidence']:.0%} confidence"
        )

current = totals()
calorie_ratio = current["calories"] / goal["calories"] if goal["calories"] else 0
calorie_percentage = min(calorie_ratio * 100, 100)
calorie_over_budget = current["calories"] > goal["calories"]
calorie_color = "#dc143c" if calorie_over_budget else "#22c55e"

metric_columns = st.columns(4)
metric_columns[0].metric("Calories", f"{current['calories']:.0f} kcal", f"{goal['calories']} kcal goal")
metric_columns[1].metric("Protein", f"{current['protein']:.1f} g", f"{goal['protein']} g goal")
metric_columns[2].metric("Carbs", f"{current['carbs']:.1f} g", f"{goal['carbs']} g goal")
metric_columns[3].metric("Fats", f"{current['fats']:.1f} g", f"{goal['fats']} g goal")

st.markdown(
    f"""
    <div class="calorie-progress-track" role="progressbar"
         aria-valuenow="{current['calories']:.0f}"
         aria-valuemin="0" aria-valuemax="{goal['calories']}">
        <div class="calorie-progress-fill"
             style="width: {calorie_percentage:.1f}%; background-color: {calorie_color};"></div>
    </div>
    <div class="calorie-progress-label">
        {current['calories']:.0f} of {goal['calories']} kcal logged
    </div>
    """,
    unsafe_allow_html=True,
)
if calorie_over_budget:
    st.error(
        f"Daily Budget Exceeded! You are "
        f"{current['calories'] - goal['calories']:.0f} kcal over today's budget."
    )
else:
    st.success(f"{goal['calories'] - current['calories']:.0f} kcal remaining today.")

st.subheader("Today's meals")
if st.session_state.meals:
    st.dataframe(
        [
            {
                "Time": meal["time"],
                "Food": meal["name"],
                "Portion": f"{meal['portion']} g",
                "Calories": f"{meal['calories']:.0f} kcal",
                "Protein": f"{meal['protein']:.1f} g",
                "Carbs": f"{meal['carbs']:.1f} g",
                "Fats": f"{meal['fats']:.1f} g",
            }
            for meal in st.session_state.meals
        ],
        use_container_width=True,
        hide_index=True,
    )
    if st.button("Clear today's meals"):
        st.session_state.meals = []
        st.rerun()
else:
    st.info("No meals logged yet. Choose a food in the sidebar to get started.")
