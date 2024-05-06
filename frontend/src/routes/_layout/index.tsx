import { AspectRatio, Box, Button, Card, CardBody, CardFooter, CardHeader, Container, FormControl, FormLabel, Grid, Heading, Image, Input, Select, Spacer, Stack, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { useCallback, useEffect, useState } from "react"
import sampleVideo from "../../assets/sample4.mp4"
import type { UserPublic } from "../../client"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function Dashboard() {
  const queryClient = useQueryClient()

  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"]);
  const [ws, setWs] = useState<WebSocket>();
  const [plateNumber, setPlateNumber] = useState("");
  const [frame, setFrame] = useState(null);
  const [detections, setDetections] = useState<Array<any>>([]);
  const [mediaDevices, setMediaDevices] = useState<Array<MediaDeviceInfo>>();
  const [deviceId, setDeviceId] = useState("");
  const [detecting, setDetecting] = useState(false);

  const handleSave = async () => {
    // TODO: make sure to format to uppercase before saving
    // to db.
    console.log(plateNumber.toUpperCase())
    setPlateNumber("")
    setDetections([])
  }

  const IMAGE_INTERVAL_MS = 2000;

  const startDetection = (video: HTMLVideoElement, canvas: HTMLCanvasElement, deviceId: string) => {
    const socket = new WebSocket('ws://localhost/detection');
    let intervalId: NodeJS.Timeout;

    // Connection opened
    socket.addEventListener('open', function () {
      setDetecting(true)
      // Start reading video from device
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId,
          width: { max: 600 },
          height: { max: 460 },
        },
      }).then(function (stream) {
          video.srcObject = stream;
          video.play().then(() => {
            // Adapt overlay canvas size to the video size
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Send an image in the WebSocket every 1000 ms
            intervalId = setInterval(() => {

              // Create a virtual canvas to draw current video image
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx?.drawImage(video, 0, 0);

              // Convert it to JPEG and send it to the WebSocket
              canvas.toBlob((blob) => socket.send(blob!), 'image/jpeg');
            }, IMAGE_INTERVAL_MS);
          });
      });

      // video.play().then(() => {
      //   // Adapt overlay canvas size to the video size
      //   canvas.width = video.videoWidth;
      //   canvas.height = video.videoHeight;
  
      //   // Send an image in the WebSocket every 1000 ms
      //   intervalId = setInterval(() => {
  
      //     // Create a virtual canvas to draw current video image
      //     const canvas = document.createElement('canvas');
      //     const ctx = canvas.getContext('2d');
      //     canvas.width = video.videoWidth;
      //     canvas.height = video.videoHeight;
      //     ctx?.drawImage(video, 0, 0);
  
      //     // Convert it to JPEG and send it to the WebSocket
      //     canvas.toBlob((blob) => socket.send(blob!), 'image/jpeg');
      //   }, IMAGE_INTERVAL_MS);
      // });
    });

    // Listen for messages
    socket.addEventListener('message', function (event) {
      const data = JSON.parse(event.data);
      if (data.text) {
        setDetections((curr) => {
          const temp = [...curr];
          temp.push(data)
          return temp.slice(-8)
        });
      }
    });

    // Stop the interval and video reading on close
    socket.addEventListener('close', function () {
      window.clearInterval(intervalId);
      handleStopDetection()
    });

    setWs(socket);
  };

  const loadMediaDevices = () => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setMediaDevices(devices)
    });
  }

  const handleStartup = useCallback(() => {
    const video = document.getElementById('video') as HTMLVideoElement;
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;

    // Close previous socket is there is one
    if (ws && detecting) {
      ws.close();
    }

    startDetection(video, canvas, deviceId);
  }, [deviceId, ws])

  const handleStopDetection = () => {
    ws?.close();
    setDetecting(false)

    const video = document.getElementById('video') as HTMLVideoElement;
    video.srcObject = null
  }

  useEffect(() => {
    loadMediaDevices();

    return () => {
      ws?.close()
    }
  }, [])

  return (
    <>
      <Container maxW="full">
        <Box mt={4} maxH='100vh' overflow='auto' pos='relative'>
          {/* Camera preview */}
          <Spacer height={12} />
          <Heading size='lg'>Live Monitoring</Heading>
          <Spacer height={3} />
          <Grid templateColumns='1fr 2fr' gap={6}>
            {/* Select media device and start */}
            <Box pos='sticky' top={3}>
              <Stack direction="row" gap={3} py={3}>
                <Select placeholder='Camera device'>
                  {mediaDevices?.filter(device => device.kind === 'videoinput' && device.deviceId).map((device, index) => {
                    const id = device.deviceId
                    return (
                      <option key={id} value={id}>
                        {device.label || `Camera ${index}`}
                      </option>
                    )
                  })}
                </Select>
                <Button colorScheme={!detecting ? "green" : "red"} onClick={!detecting ? handleStartup : handleStopDetection} width="100%">
                  {!detecting ? "Start Detection" : "STOP"}
                </Button>
              </Stack>
              <Stack py={3}>
                <Box position="relative">
                  <AspectRatio width='100%' ratio={4 / 3}>
                    <video
                      id="video"
                      // src={sampleVideo}
                      poster="https://placehold.co/600x400?text=Feed+Unavailable"
                      onContextMenu={(e) => e.preventDefault()}
                      loop muted autoPlay
                    />
                  </AspectRatio>
                  <canvas id="canvas" style={{ position: "absolute", top: 0, left: 0 }}></canvas>
                </Box>
              </Stack>
              <Box p={3}>
                <FormControl isRequired>
                  <FormLabel>Plate number</FormLabel>
                  <Input type='text' value={plateNumber} onChange={(e) => {
                    setPlateNumber(e.target.value)
                  }} />
                </FormControl>
                <Spacer height={3} />
                <Button variant='solid' colorScheme='blue' onClick={handleSave} disabled={true}>
                  Save plate number
                </Button>
              </Box>
            </Box>

            <Box py={3}>
              <Heading size='md'>Detections</Heading>
              <Text py='2'>
                Select a detection to save or input plate number if no detection is correct or found
              </Text>
              <Grid gap={4} templateColumns='repeat(4, 1fr)'>
                {detections.map((item, index) => (
                  <Card>
                    {/* <CardBody> */}
                    <Image src={`data:image/jpg;base64, ${item.plateImage}`} />
                    {/* </CardBody> */}
                    <CardFooter flexDirection='column'>
                      {/* <Box mb={2}>
                        <Text>D={Number(item.detectionScore).toFixed(2)} R={Number(item.recognitionScore).toFixed(2)}</Text>
                      </Box> */}
                      <Button
                        key={index}
                        colorScheme={item === plateNumber ? 'green' : 'gray'}
                        onClick={() => setPlateNumber(item.text)}
                        width='100%'
                      >
                        <Text>{item.text}</Text>
                      </Button>
                    </CardFooter>
                  </Card>

                ))}
              </Grid>
            </Box>
          </Grid>
        </Box>
        <Spacer h={80}/>
        {/* <iframe src="http://localhost:4200/cumulative-total" width={600} height={200} ></iframe> */}
        <Spacer h={60}/>
      </Container>
    </>
  )
}
