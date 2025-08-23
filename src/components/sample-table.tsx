import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"

  
  const recents = [
      {
        id: "T510-2024-2527",
        employeeName: "Name 6",
        department: "Finance",
        dateSubmitted: "07/25/2025",
        time: "8:15 PM"
      },
      {
        id: "T248-2020-3992",
        employeeName: "Name 15",
        department: "IT",
        dateSubmitted: "08/09/2025",
        time: "12:15 AM"
      },
      {
        id: "T321-2025-7643",
        employeeName: "Name 9",
        department: "Engineering",
        dateSubmitted: "08/16/2025",
        time: "11:15 PM"
      },
      {
        id: "T499-2021-6396",
        employeeName: "Name 3",
        department: "Finance",
        dateSubmitted: "08/02/2025",
        time: "11:00 PM"
      },
      {
        id: "T569-2025-1809",
        employeeName: "Name 14",
        department: "Sales",
        dateSubmitted: "08/08/2025",
        time: "3:45 PM"
      },
      {
        id: "T854-2023-1920",
        employeeName: "Name 12",
        department: "Marketing",
        dateSubmitted: "08/12/2025",
        time: "10:30 AM"
      },
      {
        id: "T372-2025-5674",
        employeeName: "Name 7",
        department: "Operations",
        dateSubmitted: "08/04/2025",
        time: "1:15 PM"
      },
      {
        id: "T283-2022-6541",
        employeeName: "Name 1",
        department: "Human Resources",
        dateSubmitted: "07/29/2025",
        time: "2:45 PM"
      },
      // {
      //   id: "T904-2025-3412",
      //   employeeName: "Name 14",
      //   department: "Engineering",
      //   dateSubmitted: "08/15/2025",
      //   time: "4:00 PM"
      // },
      // {
      //   id: "T185-2021-4429",
      //   employeeName: "Name 8",
      //   department: "Finance",
      //   dateSubmitted: "08/05/2025",
      //   time: "9:00 AM"
      // },
      // {
      //   id: "T639-2024-7854",
      //   employeeName: "Name 2",
      //   department: "Marketing",
      //   dateSubmitted: "08/18/2025",
      //   time: "6:15 PM"
      // },
      // {
      //   id: "T572-2025-2148",
      //   employeeName: "Name 10",
      //   department: "Sales",
      //   dateSubmitted: "08/14/2025",
      //   time: "7:30 AM"
      // },
      // {
      //   id: "T430-2020-8391",
      //   employeeName: "Name 5",
      //   department: "Operations",
      //   dateSubmitted: "08/01/2025",
      //   time: "5:45 PM"
      // },
      // {
      //   id: "T921-2025-5463",
      //   employeeName: "Name 11",
      //   department: "Human Resources",
      //   dateSubmitted: "07/31/2025",
      //   time: "8:30 AM"
      // },
      // {
      //   id: "T754-2022-9204",
      //   employeeName: "Name 16",
      //   department: "IT",
      //   dateSubmitted: "08/10/2025",
      //   time: "10:15 PM"
      // },
      // {
      //   id: "T812-2023-1347",
      //   employeeName: "Name 4",
      //   department: "Engineering",
      //   dateSubmitted: "08/07/2025",
      //   time: "1:45 PM"
      // },
      // {
      //   id: "T690-2025-2398",
      //   employeeName: "Name 13",
      //   department: "Finance",
      //   dateSubmitted: "08/11/2025",
      //   time: "11:00 AM"
      // },
      // {
      //   id: "T268-2024-4712",
      //   employeeName: "Name 17",
      //   department: "Sales",
      //   dateSubmitted: "08/06/2025",
      //   time: "9:45 PM"
      // },
      // {
      //   id: "T843-2025-5581",
      //   employeeName: "Name 20",
      //   department: "Operations",
      //   dateSubmitted: "08/03/2025",
      //   time: "3:00 PM"
      // },
      // {
      //   id: "T329-2021-9072",
      //   employeeName: "Name 15",
      //   department: "Marketing",
      //   dateSubmitted: "08/13/2025",
      //   time: "7:15 PM"
      // },
  ]
  
  export function TableDemo() {
    return (
      
    <Card className="h-full flex flex-col @container/card">
        <CardHeader>
        <CardTitle>Recent Submission</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recents.map((recents) => (
            <TableRow key={recents.id}>
              <TableCell className="font-medium">{recents.employeeName}</TableCell>
              <TableCell>{recents.department}</TableCell>
              <TableCell>{recents.dateSubmitted}</TableCell>
              <TableCell className="text-right">{recents.time}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </CardContent>
      </Card>
    )
  }
  