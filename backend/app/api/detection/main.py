import asyncio
import base64
import time
import os

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
        self.latest_frame = None
        self.running = False

        # Variables for image collection and processing
        self.plate_image = None
        self.plate_images = []
        self.image_size_up = 50
        self.image_scale = 2

        # Variables for logging and benchmarking
        self.last_time = time.time()
        
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

    def preprocess(self, img):
        #Convert from colored to Grayscale.
        gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        #Applying Bilateral Filter on the grayscale image.
        '''Bilateral Filter : A bilateral filter is a non-linear, edge-preserving,
        and noise-reducing smoothing filter for images.
        It replaces the intensity of each pixel with a weighted average of intensity values from nearby pixels.'''
        #It will remove noise while preserving the edges. So, the number plate remains distinct.
        denoised_img = cv2.fastNlMeansDenoising(gray_img)
        filtered_img = cv2.bilateralFilter(denoised_img, 9, 15, 15)

        '''Canny Edge detector : The Process of Canny edge detection algorithm can be broken down to 5 different steps:

        1. Apply Gaussian filter to smooth the image in order to remove the noise
        2. Find the intensity gradients of the image
        3. Apply non-maximum suppression to get rid of spurious response to edge detection
        4. Apply double threshold to determine potential edges
        5. Track edge by hysteresis: Finalize the detection of edges by suppressing all the other edges that are weak and not connected to strong edges.'''
        #Finding edges of the grayscale image.
        c_edge = cv2.Canny(filtered_img, 170, 200)

        #Finding contours based on edges detected.
        cnt, new = cv2.findContours(c_edge, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        #Storing the top 30 edges based on priority
        cnt = sorted(cnt, key = cv2.contourArea, reverse = True)[:30]

        NumberPlateContours = []

        im2 = img.copy()
        cv2.drawContours(im2, cnt, -1, (0,255,0), 3)

        for c in cnt:
            # Get the bounding rectangle
            x, y, w, h = cv2.boundingRect(c)
        
            # Calculate aspect ratio
            aspect_ratio = float(w)/h 

            # The aspect ratio of a typical Nigerian number plate is about 2:1
            if aspect_ratio > 1.5 and aspect_ratio < 2.5:
                NumberPlateContours.append(c)

        '''A picture can be stored as a numpy array. Thus to mask the unwanted portions of the
        picture, we simply convert it to a zeros array.'''
        #Masking all other parts, other than the number plate.
        masked = np.zeros(filtered_img.shape,np.uint8)
        new_image = cv2.drawContours(masked,NumberPlateContours,0,255,-1)
        new_image = cv2.bitwise_and(filtered_img,filtered_img,mask=masked)

        # Enhanced contrast for clarity
        new_image = cv2.equalizeHist(new_image)

        # Apply adaptive thresholding since the image can have varying illumination
        # gray_img = cv2.cvtColor(new_image, cv2.COLOR_BGR2GRAY)
        # new_image = cv2.adaptiveThreshold(np.array(new_image,dtype=np.uint8),255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY,11,2)
        # threshed_img = cv2.threshold(new_image,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)[1]
        final_img = cv2.threshold(new_image,90,255,cv2.THRESH_BINARY)[1]

        return final_img

    async def detect(self, queue: asyncio.Queue):
        """
        This is used to handle detection and recognition
        """
        self.running = True
        while self.running:
            try:
                bytes = await queue.get()
                data = np.frombuffer(bytes, dtype=np.uint8)
                self.latest_frame = cv2.imdecode(data, 1)

                detections = self.license_plate_detector(self.latest_frame, verbose=False)[0]

                frame = self.latest_frame

                for detection in detections.boxes.data.tolist():
                    x1, y1, x2, y2, detection_score, class_id = detection

                    # try:
                    #     car_image = frame[int(y1 - self.image_size_up):int(y2 + self.image_size_up),
                    #                         int(x1 - self.image_size_up):int(x2 + self.image_size_up)]
                    # except Exception as e:
                    #     print(f"Exception: {e}")
                    #     car_image = frame[int(y1 - self.image_size_up/2):int(y2 + self.image_size_up/2),
                    #                         int(x1 - self.image_size_up/2):int(x2 + self.image_size_up/2)]
                    try:
                        car_image = frame[int(y1):int(y2), int(x1):int(x2)]
                    except Exception as e:
                        print(f"Exception: {e}")
                        car_image = frame[int(y1 - self.image_size_up/2):int(y2 + self.image_size_up/2),
                                            int(x1 - self.image_size_up/2):int(x2 + self.image_size_up/2)]
                    
                    # print("plate image has content? ", plate_image.any())
                    if not car_image.any():
                        continue

                    # process license plate
                    gray_img = cv2.cvtColor(car_image, cv2.COLOR_BGR2GRAY)
                    denoised_img = cv2.fastNlMeansDenoising(gray_img)
                    filtered_img = cv2.bilateralFilter(denoised_img, 9, 15, 15)
                    plate_image = cv2.equalizeHist(filtered_img)
                    # plate_image = cv2.adaptiveThreshold(plate_image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
                    plate_image = cv2.threshold(plate_image,90,255,cv2.THRESH_BINARY)[1]
                    # plate_image = self.preprocess(frame)

                    # read license plate number
                    license_plate_text, license_plate_text_score = read_license_plate(plate_image)

                    if license_plate_text is not None:
                        # Send data (frame and detections) as JSON to the frontend via websocket
                        encoded_car_frame = cv2.imencode('.jpg', car_image)[1].tobytes()
                        encoded_plate_frame = cv2.imencode('.jpg', plate_image)[1].tobytes()

                        base64_encoded_car_frame = base64.b64encode(encoded_car_frame).decode('utf-8')
                        base64_encoded_plate_frame = base64.b64encode(encoded_plate_frame).decode('utf-8')

                        await self.websocket.send_json({
                            "carImage": base64_encoded_car_frame,
                            "plateImage": base64_encoded_plate_frame,
                            "detectionScore": detection_score,
                            "text": license_plate_text,
                            "recognitionScore": license_plate_text_score 
                        })
            except Exception as e:
                print(f"An error occurred on processing car image. Exception: {e}")
                self.running = False
