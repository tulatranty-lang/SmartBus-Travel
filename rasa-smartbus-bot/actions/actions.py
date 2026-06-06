from typing import Any, Text, Dict, List
from pathlib import Path
import csv
import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

DATA_DIR = Path(__file__).resolve().parents[1] / "data_bus"
BACKEND_CHAT_URL = "http://localhost:5000/api/v1/chatbot/ask"
BACKEND_PLACES_URL = "http://localhost:5000/api/v1/tourism/places/search"
BACKEND_TRIP_URL = "http://localhost:5000/api/v1/trip-plans/generate"


def norm(text: str) -> str:
    return (text or "").lower()


def load_routes():
    try:
        with open(DATA_DIR / "routes.csv", encoding="utf-8") as f:
            return list(csv.DictReader(f))
    except Exception:
        return []


def load_places():
    path = DATA_DIR / "places.csv"
    if not path.exists():
        return []
    try:
        with open(path, encoding="utf-8") as f:
            return list(csv.DictReader(f))
    except Exception:
        return []


def pick_route(text: str):
    routes = load_routes()
    t = norm(text)
    rid = None
    if "hội an" in t or "hoi an" in t or "phố cổ" in t:
        rid = "02"
    elif "bà nà" in t or "ba na" in t or "bana" in t:
        rid = "03"
    elif "sân bay" in t or "san bay" in t:
        rid = "06" if "vku" in t or "việt hàn" in t else "03"
    elif "tam kỳ" in t or "tam ky" in t:
        rid = "21"
    else:
        for candidate in ["02", "03", "05", "06", "07", "12", "21"]:
            if candidate in t:
                rid = candidate
                break
    return next((r for r in routes if r.get("id") == rid), None)


def try_backend_chat(message: str):
    try:
        res = requests.post(BACKEND_CHAT_URL, json={"message": message}, timeout=1.5)
        if res.ok:
            return res.json().get("reply")
    except Exception:
        return None


def try_backend_places(message: str):
    try:
        res = requests.get(BACKEND_PLACES_URL, params={"q": message}, timeout=1.5)
        if res.ok:
            payload = res.json()
            return payload.get("data") or payload
    except Exception:
        return None


class ActionFindBestRoute(Action):
    def name(self) -> Text:
        return "action_find_best_route"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        message = tracker.latest_message.get("text", "")
        backend_reply = try_backend_chat(message)
        if backend_reply:
            dispatcher.utter_message(text=backend_reply)
            return []
        route = pick_route(message)
        if not route:
            dispatcher.utter_message(text="Tôi chưa nhận ra điểm đến. Bạn hãy nhập rõ hơn, ví dụ: Tôi muốn đến Hội An hoặc VKU ra sân bay.")
            return []
        dispatcher.utter_message(text=f"Bạn có thể đi tuyến {route['id']} – {route['name']}. Giá vé {route['fare']}, tần suất {route['interval']}.")
        return []


class ActionFindNearestStop(Action):
    def name(self) -> Text:
        return "action_find_nearest_stop"

    def run(self, dispatcher, tracker, domain):
        dispatcher.utter_message(text="Bạn hãy bật GPS trên web SmartBus. Khi có vị trí, mình sẽ tìm bến gần nhất, khoảng cách đi bộ và tuyến phù hợp theo dữ liệu bản đồ.")
        return []


class ActionEstimateBusEta(Action):
    def name(self) -> Text:
        return "action_estimate_bus_eta"

    def run(self, dispatcher, tracker, domain):
        message = tracker.latest_message.get("text", "")
        route = pick_route(message) or {"id": tracker.get_slot("route_id") or "02", "interval": "20 phút"}
        dispatcher.utter_message(text=f"ETA demo tuyến {route['id']} khoảng {route.get('interval', '10–20 phút')} tùy bến hiện tại.")
        return []


class ActionShowFare(Action):
    def name(self) -> Text:
        return "action_show_fare"

    def run(self, dispatcher, tracker, domain):
        message = tracker.latest_message.get("text", "")
        route = pick_route(message)
        if route:
            dispatcher.utter_message(text=f"Tuyến {route['id']} – {route['name']} có giá vé {route['fare']}.")
        else:
            dispatcher.utter_message(text="Bạn cho tôi mã tuyến hoặc điểm đến để tra giá vé nhé.")
        return []


class ActionShowSchedule(Action):
    def name(self) -> Text:
        return "action_show_schedule"

    def run(self, dispatcher, tracker, domain):
        message = tracker.latest_message.get("text", "")
        route = pick_route(message)
        if route:
            dispatcher.utter_message(text=f"Tuyến {route['id']} chạy {route['time']}, tần suất {route['interval']}.")
        else:
            dispatcher.utter_message(text="Bạn cho tôi mã tuyến để xem lịch chạy nhé.")
        return []


class ActionCreateReport(Action):
    def name(self) -> Text:
        return "action_create_report"

    def run(self, dispatcher, tracker, domain):
        dispatcher.utter_message(text="Tôi đã ghi nhận phản ánh demo. Trên web app, bạn có thể gửi báo cáo chi tiết ở mục Gửi báo cáo.")
        return []


class ActionFindTouristPlaces(Action):
    def name(self) -> Text:
        return "action_find_tourist_places"

    def run(self, dispatcher, tracker, domain):
        message = tracker.latest_message.get("text", "")
        backend_places = try_backend_places(message)
        if backend_places:
            names = ", ".join([p.get("name", "") for p in backend_places[:3]])
            dispatcher.utter_message(text=f"Tôi gợi ý bạn xem: {names}. Hãy mở trang Địa điểm du lịch trên web app để xem bến gần nhất và tuyến bus.")
            return []
        places = load_places()
        if not places:
            dispatcher.utter_message(text="Bạn có thể thử Hội An, Bà Nà Hills, Mỹ Khê, Cầu Rồng hoặc Chợ Hàn.")
            return []
        dispatcher.utter_message(text="Gợi ý địa điểm: " + ", ".join(p.get("name", "") for p in places[:3]))
        return []


class ActionRecommendTripPlan(Action):
    def name(self) -> Text:
        return "action_recommend_trip_plan"

    def run(self, dispatcher, tracker, domain):
        message = tracker.latest_message.get("text", "")
        try:
            res = requests.post(BACKEND_TRIP_URL, json={"timeAvailable": tracker.get_slot("time_available") or "1 buổi", "interests": [message]}, timeout=1.5)
            if res.ok:
                payload = res.json().get("data") or res.json()
                names = " → ".join([i.get("name", "") for i in payload.get("items", [])])
                dispatcher.utter_message(text=f"Lịch trình gợi ý: {names}.")
                return []
        except Exception:
            pass
        dispatcher.utter_message(text="Lịch trình tiết kiệm gợi ý: Cầu Rồng → Chợ Hàn → Biển Mỹ Khê bằng các tuyến trung tâm và tuyến 05.")
        return []


class ActionShowPlaceReviews(Action):
    def name(self) -> Text:
        return "action_show_place_reviews"

    def run(self, dispatcher, tracker, domain):
        message = tracker.latest_message.get("text", "")
        backend_reply = try_backend_chat(message)
        if backend_reply:
            dispatcher.utter_message(text=backend_reply)
            return []
        dispatcher.utter_message(text="Review mẫu: địa điểm này được đánh giá tốt nếu đi sớm, chọn bến gần nhất và tránh giờ cao điểm.")
        return []


class ActionFindReviews(Action):
    def name(self) -> Text:
        return "action_find_reviews"

    def run(self, dispatcher, tracker, domain):
        message = tracker.latest_message.get("text", "")
        backend_reply = try_backend_chat(message)
        if backend_reply:
            dispatcher.utter_message(text=backend_reply)
        else:
            dispatcher.utter_message(text="Bạn mở mục Cộng đồng review để xem bài mẫu và bài người dùng. Bạn có thể hỏi rõ hơn như: Có review về Biển Mỹ Khê không?")
        return []


class ActionSaveFavorite(Action):
    def name(self) -> Text:
        return "action_save_favorite"

    def run(self, dispatcher, tracker, domain):
        dispatcher.utter_message(text="Bạn cần đăng nhập trên web SmartBus để lưu tuyến, địa điểm hoặc lịch trình yêu thích. Sau khi đăng nhập, hãy bấm nút Lưu trên card tương ứng.")
        return []


class ActionExplainGps(Action):
    def name(self) -> Text:
        return "action_explain_gps"

    def run(self, dispatcher, tracker, domain):
        dispatcher.utter_message(text="GPS phụ thuộc quyền trình duyệt và độ chính xác thiết bị. Hãy bấm nút định vị, cho phép quyền vị trí, rồi hỏi: Bến xe buýt gần tôi nhất ở đâu?")
        return []
