import { AspectRatio, Box, Button, Card, CardBody, CardFooter, CardHeader, Container, FormControl, FormLabel, Grid, Heading, Image, Input, Select, Spacer, Stack, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { useCallback, useEffect, useState } from "react"
import sampleVideo from "../../assets/sample3.mp4"
import type { UserPublic } from "../../client"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

const TEMP = 
  ["LSQ5ASH",
  // "IG497OI",
  // "LC63K9I",
  // "LE53IQ2",
  // "LE53I8S",
  "LG83A98",
  "LGE3I9A",
  "LE83ISA",
  "LG53I9I",
  "LG43I9I",
  "IG55I9I",
  "LE83I9A"
]

function Dashboard() {
  const queryClient = useQueryClient()

  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"]);
  const [ws, setWs] = useState<WebSocket>();
  const [plateNumber, setPlateNumber] = useState("");
  const [frame, setFrame] = useState(null);
  const [detections, setDetections] = useState<Array<string>>(TEMP);
  const [mediaDevices, setMediaDevices] = useState<Array<MediaDeviceInfo>>();
  const [deviceId, setDeviceId] = useState("");
  const [detecting, setDetecting] = useState(false);

  const handleSave = async () => {
    // TODO: make sure to format to uppercase before saving
    // to db.
    console.log(plateNumber.toUpperCase())
    setPlateNumber("")
  }

  const IMAGE_INTERVAL_MS = 1500;

  const startDetection = (video: HTMLVideoElement, canvas: HTMLCanvasElement, deviceId: string) => {
    const socket = new WebSocket('ws://localhost/detection');
    let intervalId: NodeJS.Timeout;

    // Connection opened
    socket.addEventListener('open', function () {
      setDetecting(true)
      // Start reading video from device
      // navigator.mediaDevices.getUserMedia({
      //   audio: false,
      //   video: {
      //     deviceId,
      //     width: { max: 600 },
      //     height: { max: 460 },
      //   },
      // }).then(function (stream) {
      //   video.srcObject = stream;
      //   video.play().then(() => {
      //     // Adapt overlay canvas size to the video size
      //     canvas.width = video.videoWidth;
      //     canvas.height = video.videoHeight;

      //     // Send an image in the WebSocket every 500 ms
      //     intervalId = setInterval(() => {

      //       // Create a virtual canvas to draw current video image
      //       const canvas = document.createElement('canvas');
      //       const ctx = canvas.getContext('2d');
      //       canvas.width = video.videoWidth;
      //       canvas.height = video.videoHeight;
      //       ctx?.drawImage(video, 0, 0);

      //       // Convert it to JPEG and send it to the WebSocket
      //       canvas.toBlob((blob) => socket.send(blob!), 'image/jpeg');
      //     }, IMAGE_INTERVAL_MS);
      //   });
      // });
      video.play().then(() => {
        // Adapt overlay canvas size to the video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Send an image in the WebSocket every 500 ms
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

    // Listen for messages
    socket.addEventListener('message', function (event) {
      const data = JSON.parse(event.data);
      console.log("detection", data.detection)
        if (data.detection) {
          setDetections((curr) => {
            const temp = [...curr];
            temp.push(data.detection as string)
            return temp.slice(-15)
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
        <Box pt={12} m={4}>
          {/* Camera preview */}
          <Spacer height={12} />
          <Heading size='lg'>Video Feed</Heading>
          <Spacer height={3} />
          <Card
            direction={{ base: 'column', sm: 'row' }}
            overflow='hidden'
            variant='outline'
          >
            <Grid templateColumns="600px auto" gap={6}>
              <Stack>
                <Box  position="relative">
                  <AspectRatio width='600px' ratio={4/3}>
                    <video
                      id="video"
                      src={sampleVideo}
                      poster="https://placehold.co/600x400?text=Feed+Unavailable"
                      onContextMenu={(e) => e.preventDefault()}
                      loop muted autoPlay
                    />
                  </AspectRatio>
                  <canvas id="canvas" style={{ position: "absolute", top: 0, left: 0 }}></canvas>
                </Box>
                
                {/* Select media device and start */}
                <Stack direction="row" gap={3} width={600} p={3}>
                  {/* <Select placeholder='Select camera device'>
                    {mediaDevices?.filter(device => device.kind === 'videoinput' && device.deviceId).map(device => {
                      const id = device.deviceId
                      return (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      )
                    })}
                  </Select> */}
                  <Button colorScheme={!detecting ? "green" : "red"} onClick={!detecting ?  handleStartup : handleStopDetection} width="100%">
                    {!detecting ? "Start Detection" : "STOP"}
                  </Button>
                </Stack>
              </Stack>

              <Stack>
                <CardBody>
                  <Heading size='md'>Detections</Heading>
                  <Text py='2'>
                    Select a detection to save or input plate number if no detection is correct or found
                  </Text>
                  <Stack direction='row' wrap="wrap" spacing={4} align='center'>
                    {detections.map((item, index) => (
                      <Button key={index} colorScheme={item === plateNumber ? 'green' : 'gray'} onClick={() => setPlateNumber(item)}>
                        {item}
                      </Button>
                    ))}
                  </Stack>
                  <Spacer height={3} />
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
                </CardBody>
              </Stack>
            </Grid>
            
          </Card>
        </Box>
      </Container>
    </>
  )
}
