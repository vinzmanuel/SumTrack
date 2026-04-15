import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { assessBorrowerReapprovalRisk } from "@/app/dashboard/borrowers/risk-assessment";

type RouteContext = {
  params: Promise<{
    borrowerId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await getDashboardAuthContext();

  if (!auth.ok) {
    return NextResponse.json(
      { message: auth.message || "You must be logged in to assess borrower risk." },
      {
        status: auth.reason === "unauthenticated" ? 401 : 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (auth.roleName === "Secretary") {
    return NextResponse.json(
      { message: "Secretaries are not authorized to assess borrower risk." },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  try {
    const { borrowerId } = await context.params;
    const result = await assessBorrowerReapprovalRisk({
      auth,
      borrowerId,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error && typeof error.status === "number"
        ? error.status
        : 500;
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to complete borrower risk assessment.";

    return NextResponse.json(
      { message },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
