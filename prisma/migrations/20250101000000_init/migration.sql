-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('VACANT', 'OCCUPIED', 'RESERVED', 'DIRTY', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('STANDARD', 'DELUXE', 'SUITE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('GUEST', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WALK_IN', 'PHONE', 'EMAIL', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingPlatform" AS ENUM ('AGODA', 'BOOKING_COM', 'TRIP_COM', 'EXPEDIA', 'HOTELS_COM', 'AIRBNB', 'TRAVELOKA', 'DIRECT_WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('ADMINISTRATOR', 'FRONT_DESK', 'HOUSEKEEPING', 'SECURITY');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('CLEAN', 'DIRTY', 'CLEANING', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'GCASH', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SUPPLIES', 'MAINTENANCE', 'FOOD_BEVERAGE', 'TRANSPORT', 'UTILITIES', 'SALARY', 'OTHER');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'STANDARD',
    "description" TEXT NOT NULL DEFAULT '',
    "maxPax" INTEGER NOT NULL DEFAULT 2,
    "status" "RoomStatus" NOT NULL DEFAULT 'VACANT',
    "baseRate" DECIMAL(65,30) NOT NULL,
    "breakfastRate" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "contactNumber" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "idPhotoFileName" TEXT,
    "address" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" "EmployeeRole" NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "scheduledArrival" TIMESTAMP(3),
    "scheduledDeparture" TIMESTAMP(3),
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "extensionDays" INTEGER NOT NULL DEFAULT 0,
    "extensionHours" INTEGER NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "bookingType" "BookingType" NOT NULL DEFAULT 'GUEST',
    "bookingSource" "BookingSource" NOT NULL DEFAULT 'PHONE',
    "bookingPlatform" "BookingPlatform",
    "bookingReference" TEXT,
    "encodedById" TEXT,
    "checkedInById" TEXT,
    "checkedOutById" TEXT,
    "cancellationReason" TEXT,
    "rebookReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folio" (
    "id" TEXT NOT NULL,
    "folioNumber" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod",
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "ownerReceivedAt" TIMESTAMP(3),
    "ownerReceivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioPayment" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,

    CONSTRAINT "FolioPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioLine" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "rate" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "FolioLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingTask" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "HousekeepingStatus" NOT NULL DEFAULT 'DIRTY',
    "assignedTo" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'RealtyBytes',
    "tagline" TEXT NOT NULL DEFAULT '',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0.12,
    "currencyCode" TEXT NOT NULL DEFAULT 'PHP',
    "receiptFooter" TEXT,

    CONSTRAINT "HotelSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "vendor" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayCloseRecord" (
    "id" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "expectedCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expectedGcash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expectedCard" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expectedBankTransfer" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "actualCash" DECIMAL(65,30),
    "actualGcash" DECIMAL(65,30),
    "actualCard" DECIMAL(65,30),
    "actualBankTransfer" DECIMAL(65,30),
    "notes" TEXT,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayCloseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_folioNumber_key" ON "Folio"("folioNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_reservationId_key" ON "Folio"("reservationId");

-- CreateIndex
CREATE INDEX "FolioPayment_paidAt_idx" ON "FolioPayment"("paidAt");

-- CreateIndex
CREATE INDEX "FolioPayment_recordedById_idx" ON "FolioPayment"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "HousekeepingTask_roomId_key" ON "HousekeepingTask"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "DayCloseRecord_businessDate_key" ON "DayCloseRecord"("businessDate");

-- CreateIndex
CREATE INDEX "Expense_businessDate_idx" ON "Expense"("businessDate");

-- CreateIndex
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt");

-- CreateIndex
CREATE INDEX "Expense_recordedById_idx" ON "Expense"("recordedById");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_encodedById_fkey" FOREIGN KEY ("encodedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_ownerReceivedById_fkey" FOREIGN KEY ("ownerReceivedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftNote" ADD CONSTRAINT "ShiftNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayCloseRecord" ADD CONSTRAINT "DayCloseRecord_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
