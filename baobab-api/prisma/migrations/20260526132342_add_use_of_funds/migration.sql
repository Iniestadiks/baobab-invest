-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'WAITLISTED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'BUILDER';

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "sharePercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "platform_config" ADD COLUMN     "draftValue" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "gracePeriodMonths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netAmount" DOUBLE PRECISION,
ADD COLUMN     "subSector" TEXT,
ADD COLUMN     "useOfFunds" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "countryCode" TEXT DEFAULT 'SN',
ADD COLUMN     "indicatif" TEXT DEFAULT '+221',
ADD COLUMN     "region" TEXT,
ADD COLUMN     "reputationPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "depositBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "gainBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reputation_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "label" TEXT,
    "icon" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_rankings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "rewardBadge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solidary_fund" (
    "id" TEXT NOT NULL,
    "totalReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalContributors" INTEGER NOT NULL DEFAULT 0,
    "totalProjects" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solidary_fund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_contribution" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "baobabFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operatorFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "userId" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "projectId" TEXT,
    "campaignId" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'WAVE',
    "operator" TEXT,
    "txRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "allocatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fund_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_allocation" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "projectId" TEXT,
    "adminId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fund_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goalAmount" DOUBLE PRECISION NOT NULL,
    "raised" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fund_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builder_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "sector" TEXT,
    "description" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SN',
    "totalDonated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectsSupported" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builder_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_badge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fund_badge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_userId_badge_key" ON "user_badges"("userId", "badge");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_rankings_userId_role_month_year_key" ON "monthly_rankings"("userId", "role", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "builder_profile_userId_key" ON "builder_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fund_badge_userId_badge_key" ON "fund_badge"("userId", "badge");

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_rankings" ADD CONSTRAINT "monthly_rankings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_contribution" ADD CONSTRAINT "fund_contribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_contribution" ADD CONSTRAINT "fund_contribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_contribution" ADD CONSTRAINT "fund_contribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "fund_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_allocation" ADD CONSTRAINT "fund_allocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_allocation" ADD CONSTRAINT "fund_allocation_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_campaign" ADD CONSTRAINT "fund_campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_profile" ADD CONSTRAINT "builder_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_badge" ADD CONSTRAINT "fund_badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
