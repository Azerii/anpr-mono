import asyncio
import base64
import time
import os
from threading import Thread

from fastapi.websockets import WebSocketState
import numpy as np
from ultralytics import YOLO
import cv2
from fastapi import WebSocket

from app.api.detection.util2 import read_license_plate

class LicensePlateRecognition:
    """
    Class that takes care of handling the video stream and recognising cars

    Attributes
    ----------

    Methods
    -------
    video_stream()
        Reads frames from a video stream, draws bounding boxes and displays the frame

    car_recognition()
        Gets the locations of the license plates in the image and reads from the plates

    --- Both methods run independently of one another, the car_recognition pulls frames when it is ready
    """

    def __init__(self, ws: WebSocket):
        # Variables for models and tracker
        self.websocket = ws
        self.license_plate_detector = YOLO(os.path.abspath('C:/Users/User A/csc/anpr-new/license_plate_detector.pt'), task='detect')

        # variables for display
        self.vid_stream = cv2.VideoCapture(0)
        self.main_frame = "License Plate Recognition"

        # self.eligible_vehicles = [2, 3, 5, 7]
        self.detections = []
        self.latest_frame = None

        # Variables for image collection and processing
        self.plate_image = None
        self.plate_images = []
        self.image_size_up = 50
        self.image_scale = 2

        # Variables for logging and benchmarking
        self.last_time = time.time()
        self.running = True

    async def video_stream(self):
        while self.running:
            try:
                # print(type(self.vid_stream))
                ret, frame = self.vid_stream.read()

                if not ret or not self.websocket.client_state == WebSocketState.CONNECTED:
                    self.running = False
                    break

                # print(type(frame))
                self.latest_frame = frame.copy()

                frame = cv2.resize(frame, (int(1280*.8), int(720*.8)))
                encoded_frame = cv2.imencode('.jpg', frame)[1].tobytes()
                base64_encoded_frame = base64.b64encode(encoded_frame).decode('utf-8')

                print(self.websocket.client_state)
                await self.websocket.send_json({"frame": base64_encoded_frame})
            except Exception as e:
                print("error: ", e)
                print("Video stream ended")
                self.running = False
                self.vid_stream.release()

        print("Video stream ended")
        self.running = False
        self.vid_stream.release()
        
    async def receive(self, queue: asyncio.Queue):
        """
        This is used to receive webscoket 
        connections from the admin dashboard
        """
        bytes = await self.websocket.receive_bytes()
        try:
            queue.put_nowait(bytes)
        except asyncio.QueueFull:
            pass

    async def detect(self, queue: asyncio.Queue):
        """
        This is used to handle detection and recognition
        """
        while self.running:
            try:
                bytes = await queue.get()
                data = np.frombuffer(bytes, dtype=np.uint8)
                self.latest_frame = cv2.imdecode(data, 1)

                detections = self.license_plate_detector(self.latest_frame, verbose=False)[0]

                print(detections.boxes.data.tolist())

                frame = self.latest_frame
                self.detections = []

                for detection in detections.boxes.data.tolist():
                    x1, y1, x2, y2, score, class_id = detection

                    self.detections.append([x1, y1, x2, y2, class_id])
                    try:
                        plate_image = frame[int(y1 - self.image_size_up):int(y2 + self.image_size_up),
                                            int(x1 - self.image_size_up):int(x2 + self.image_size_up)]
                    except Exception as e:
                        print(f"Exception: {e}")
                        plate_image = frame[int(y1 - self.image_size_up/2):int(y2 + self.image_size_up/2),
                                            int(x1 - self.image_size_up/2):int(x2 + self.image_size_up/2)]

                    if not plate_image.any():
                        continue

                    # process license plate
                    plate_img = cv2.cvtColor(plate_image, cv2.COLOR_BGR2GRAY)
                    # _, plate_img = cv2.threshold(plate_img, 64, 255, cv2.THRESH_BINARY_INV)
                    plate_img = cv2.equalizeHist(plate_img)
                    # plate_image = cv2.threshold(plate_image, 90, 255, cv2.THRESH_BINARY)[1]
                    plate_img = cv2.adaptiveThreshold(plate_img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)

                    # read license plate number
                    license_plate_text, license_plate_text_score = read_license_plate(plate_img)

                    if license_plate_text is not None:
                        # Send data (frame and detections) as JSON to the frontend via websocket
                        encoded_frame = cv2.imencode('.jpg', frame)[1].tobytes()
                        base64_encoded_frame = base64.b64encode(encoded_frame).decode('utf-8')
                        await self.websocket.send_json({ "frame": base64_encoded_frame, "detection": license_plate_text, "score": license_plate_text_score })
            except:
                self.running = False
