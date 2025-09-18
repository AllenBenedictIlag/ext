'use client'

import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Scratch(){
    return(
        <div>
            <Card className="gap-4">
                <CardHeader className="gap-1">
                    <CardDescription className="text-xs">Total Exits</CardDescription>
                    <CardTitle className="text-2xl sm:text-3xl tabular-nums">22</CardTitle>
                    <CardAction>
                    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
                        ▲ +16%
                    </span>
                    </CardAction>
                </CardHeader>
                <CardFooter className="text-xs text-muted-foreground">
                    Trending up this month
                </CardFooter>
            </Card>
        </div>
    );
}