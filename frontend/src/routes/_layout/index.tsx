import { AspectRatio, Box, Button, Card, CardBody, CardFooter, Container, FormControl, FormLabel, Grid, Heading, Image, Input, Spacer, Stack, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import type { UserPublic } from "../../client"
import sampleVideo from "../../assets/sample3.mp4"
import { useEffect, useState } from "react"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

const TEMP = 
  ["LSQ5ASH",
  "IG497OI",
  "LC63K9I",
  "LE53IQ2",
  "LE53I8S",
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

  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const [plateNumber, setPlateNumber] = useState("")
  // const [ws, setWs] = useState({});
  const [frame, setFrame] = useState(null);
  const [detections, setDetections] = useState<Array<string>>([]);

  useEffect(() => {
      const ws = new WebSocket('ws://localhost/detection');
      // setWs(ws);

      ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          setFrame(data.frame);
          if (data.detection) {
            setDetections((curr) => {
              const temp = [...curr];
              temp.push(data.detection as string)
              return temp.slice(-15)
            });
          }
      };

      ws.onerror = (error) => {
        console.log(JSON.stringify(error, null, 2))
      }

      // return () => ws.close();
  }, []);

  const handleSave = async () => {
    // TODO: make sure to format to uppercase before saving
    // to db.
    console.log(plateNumber.toUpperCase())
    setPlateNumber("")
  }

  return (
    <>
      <Container maxW="full">
        <Box pt={12} m={4}>
          <Text fontSize="2xl">
            Hi, {currentUser?.full_name || currentUser?.email} 👋🏼
          </Text>
          <Text>Welcome back!</Text>

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
              <AspectRatio width='600px' ratio={4 / 3}>
                <img src={frame ? `data:image/jpeg;base64,${frame}` : 'https://placehold.co/600x400?text=Feed+Unavailable'} alt="Feed" onContextMenu={(e) => e.preventDefault()} />
              </AspectRatio>

              <Stack>
                <CardBody>
                  <Heading size='md'>Detections</Heading>
                  <Text py='2'>
                    Select a detection to save or input plate number if no detection is correct or found
                  </Text>
                  <Stack direction='row' wrap="wrap" spacing={4} align='center'>
                    {detections.map(item => (
                      <Button colorScheme={item === plateNumber ? 'green' : 'gray'} onClick={() => setPlateNumber(item)}>{item}</Button>
                    ))}
                  </Stack>
                  <Spacer height={3} />
                  <FormControl isRequired>
                    <FormLabel>Plate number</FormLabel>
                    <Input type='text' value={plateNumber} onChange={(e) => {
                      setPlateNumber(e.target.value)
                    }} />
                  </FormControl>
                </CardBody>
                <CardFooter>
                  <Button variant='solid' colorScheme='blue' onClick={handleSave} disabled={true}>
                    Save plate number
                  </Button>
                </CardFooter>
              </Stack>
            </Grid>
            
          </Card>
        </Box>
      </Container>
    </>
  )
}
