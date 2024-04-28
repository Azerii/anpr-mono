import {
  Container,
  Flex,
  Heading,
  Skeleton,
  Spacer,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ItemsService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"

export const Route = createFileRoute("/_layout/items")({
  component: Items,
})

function ItemsTableBody() {
  const { data: items } = useSuspenseQuery({
    queryKey: ["items"],
    queryFn: () => ItemsService.readItems({}),
  })

  return (
    <Tbody>
      {items.data.map((item) => (
        <Tr key={item.id}>
          <Td>{item.id}</Td>
          <Td>{item.plate_number}</Td>
          <Td>{item.tally_number}</Td>
          <Td>{new Date(item.timestamp).toLocaleDateString()}</Td>
          <Td>{new Date(item.timestamp).toLocaleTimeString()}</Td>
          <Td>
            <ActionsMenu type={"Item"} value={item} />
          </Td>
        </Tr>
      ))}
      <Tr>
          <Td>1</Td>
          <Td>MUS711BU</Td>
          <Td>0001</Td>
          <Td>4/18/2024</Td>
          <Td>2:20:03 PM</Td>
          <Td>
            :
          </Td>
        </Tr>
      <Tr>
          <Td>2</Td>
          <Td>GWA866DC</Td>
          <Td>0002</Td>
          <Td>4/18/2024</Td>
          <Td>2:22:41 PM</Td>
          <Td>
            :
          </Td>
        </Tr>
        <Tr>
          <Td>3</Td>
          <Td>LG8319AA</Td>
          <Td>0003</Td>
          <Td>4/20/2024</Td>
          <Td>6:59:56 AM</Td>
          <Td>
            :
          </Td>
        </Tr>
    </Tbody>
  )
}
function ItemsTable() {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th>ID</Th>
            <Th>Plate number</Th>
            <Th>Tally number</Th>
            <Th>Date</Th>
            <Th>Time</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Tbody>
              <Tr>
                <Td colSpan={5}>Something went wrong: {error.message}</Td>
              </Tr>
            </Tbody>
          )}
        >
          <Suspense
            fallback={
              <Tbody>
                {new Array(5).fill(null).map((_, index) => (
                  <Tr key={index}>
                    {new Array(5).fill(null).map((_, index) => (
                      <Td key={index}>
                        <Flex>
                          <Skeleton height="20px" width="20px" />
                        </Flex>
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            }
          >
            <ItemsTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Items() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Plate Number Entries
      </Heading>

      {/* <Navbar type={"Item"} /> */}
      <Spacer height={12} />
      <ItemsTable />
    </Container>
  )
}
