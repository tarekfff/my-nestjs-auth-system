-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'OPERATIONS', 'CLOSER');

-- CreateEnum
CREATE TYPE "CompanyVerification" AS ENUM ('A_VERIFIER', 'EN_COURS', 'VALIDEE', 'REFUSEE', 'SUSPENDUE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('RECU', 'VALIDE', 'REFUSE');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FORMULAIRE', 'WHATSAPP', 'CAMPAGNE', 'PARTENAIRE', 'CLOSER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NOUVEAU', 'CONTACTE', 'EN_NEGOCIATION', 'CONVERTI', 'PERDU');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CDI', 'CDD', 'STAGE', 'FREELANCE', 'ALTERNANCE');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('PRESENTIEL', 'HYBRIDE', 'REMOTE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('DEBUTANT', 'JUNIOR', 'CONFIRME', 'SENIOR', 'EXPERT');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('NON_REQUIS', 'BAC', 'BAC2', 'BAC3', 'BAC5', 'DOCTORAT');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('DZD', 'EUR', 'USD');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('FR', 'AR', 'EN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('BROUILLON', 'SOUMISE', 'A_COMPLETER', 'EN_REVUE', 'PLANIFIEE', 'ACTIVE', 'CLOTUREE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "MediaRequirement" AS ENUM ('OFF', 'OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('A_ETUDIER', 'EN_COURS_ETUDE', 'PRESELECTIONNE', 'ENTRETIEN_PREVU', 'PROCESSUS_EN_COURS', 'RECRUTE', 'NON_RETENU', 'MEDIA_A_COMPLETER', 'CLOTUREE_AUTO');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('CV', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('NON_DEMANDE', 'A_ENVOYER', 'ENVOYE', 'EN_ANALYSE', 'VALIDE', 'A_REFAIRE', 'BLOQUE', 'A_VERIFIER');

-- CreateEnum
CREATE TYPE "JobRequestType" AS ENUM ('MODIFICATION', 'PROLONGATION', 'CLOTURE_ANTICIPEE');

-- CreateEnum
CREATE TYPE "JobRequestStatus" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE');

-- CreateEnum
CREATE TYPE "MsgChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "MsgStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "MsgEvent" AS ENUM ('CONFIRMATION_CANDIDATURE', 'MEDIA_A_REFAIRE', 'EN_COURS_ETUDE', 'PRESELECTION', 'ENTRETIEN', 'REFUS', 'CLOTURE', 'RAPPEL_ENTREPRISE', 'RAPPEL_CANDIDAT', 'ACCES_COMPTE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PAYEE', 'EN_ATTENTE', 'EN_RETARD');

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropIndex
DROP INDEX "RefreshToken_userId_idx";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "userId",
ADD COLUMN     "companyUserId" TEXT,
ADD COLUMN     "staffUserId" TEXT;

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Wilaya" (
    "code" INTEGER NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,

    CONSTRAINT "Wilaya_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" SERIAL NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelAr" TEXT,
    "labelEn" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'OPERATIONS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordResetCode" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "activationToken" TEXT,
    "activationExpires" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordResetCode" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectorId" INTEGER,
    "city" TEXT,
    "wilayaCode" INTEGER,
    "address" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "culture" TEXT,
    "valuesTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socials" JSONB NOT NULL DEFAULT '{}',
    "verification" "CompanyVerification" NOT NULL DEFAULT 'A_VERIFIER',
    "isCertified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "billingInfo" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'RECU',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "message" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'FORMULAIRE',
    "status" "LeadStatus" NOT NULL DEFAULT 'NOUVEAU',
    "closerId" TEXT,
    "convertedCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "contract" "ContractType" NOT NULL,
    "mode" "WorkMode" NOT NULL DEFAULT 'PRESENTIEL',
    "city" TEXT,
    "wilayaCode" INTEGER,
    "addressZone" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'DZD',
    "showSalary" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "missions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profile" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience" "ExperienceLevel",
    "education" "EducationLevel" NOT NULL DEFAULT 'NON_REQUIS',
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schedule" TEXT,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectorId" INTEGER,
    "lang" "Lang" NOT NULL DEFAULT 'FR',
    "mediaAudio" "MediaRequirement" NOT NULL DEFAULT 'OFF',
    "mediaVideo" "MediaRequirement" NOT NULL DEFAULT 'OFF',
    "desiredDelay" TEXT,
    "publishAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "decisionDeadlineAt" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'BROUILLON',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "reviewComment" TEXT,
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" BIGSERIAL NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus" NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobChangeRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "JobRequestType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "message" TEXT,
    "status" "JobRequestStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "requesterId" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "message" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'A_ETUDIER',
    "lang" "Lang" NOT NULL DEFAULT 'FR',
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" BIGSERIAL NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationMedia" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "filePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationS" INTEGER,
    "status" "MediaStatus" NOT NULL DEFAULT 'A_ENVOYER',
    "aiChecks" JSONB NOT NULL DEFAULT '{}',
    "blockReason" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaModerationLog" (
    "id" BIGSERIAL NOT NULL,
    "mediaId" TEXT NOT NULL,
    "fromStatus" "MediaStatus",
    "toStatus" "MediaStatus" NOT NULL,
    "reason" TEXT,
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaRedoLink" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaRedoLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDossier" (
    "applicationId" TEXT NOT NULL,
    "cvSummary" TEXT,
    "experiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "detectedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchingElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "toVerify" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingInfo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audioTranscript" TEXT,
    "audioSummary" TEXT,
    "videoSummary" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiDossier_pkey" PRIMARY KEY ("applicationId")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "event" "MsgEvent" NOT NULL,
    "channel" "MsgChannel" NOT NULL,
    "lang" "Lang" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "event" "MsgEvent" NOT NULL,
    "channel" "MsgChannel" NOT NULL,
    "lang" "Lang" NOT NULL,
    "applicationId" TEXT,
    "companyId" TEXT,
    "recipient" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "MsgStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMsgId" TEXT,
    "error" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "offersIncluded" INTEGER,
    "offersUsed" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issuedOn" TIMESTAMP(3) NOT NULL,
    "dueOn" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'DZD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "pdfPath" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" BIGSERIAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "jobId" TEXT,
    "packId" TEXT,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsContent" (
    "id" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "lang" "Lang" NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrl" TEXT,
    "contexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "platformName" TEXT NOT NULL DEFAULT 'OMPLEO',
    "contactEmail" TEXT,
    "activeLanguages" "Lang"[] DEFAULT ARRAY['FR', 'AR', 'EN']::"Lang"[],
    "cvMaxMb" INTEGER NOT NULL DEFAULT 5,
    "audioMaxSeconds" INTEGER NOT NULL DEFAULT 60,
    "videoMaxSeconds" INTEGER NOT NULL DEFAULT 30,
    "reminderDaysBefore" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "decisionDeadlineDays" INTEGER NOT NULL DEFAULT 14,
    "aiThresholds" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" BIGSERIAL NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUser_email_key" ON "CompanyUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUser_activationToken_key" ON "CompanyUser"("activationToken");

-- CreateIndex
CREATE INDEX "CompanyUser_companyId_idx" ON "CompanyUser"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "CompanyDocument_companyId_idx" ON "CompanyDocument"("companyId");

-- CreateIndex
CREATE INDEX "LeadNote_leadId_idx" ON "LeadNote"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");

-- CreateIndex
CREATE INDEX "Job_status_publishAt_idx" ON "Job"("status", "publishAt" DESC);

-- CreateIndex
CREATE INDEX "Job_wilayaCode_contract_sectorId_idx" ON "Job"("wilayaCode", "contract", "sectorId");

-- CreateIndex
CREATE INDEX "Job_closesAt_idx" ON "Job"("closesAt");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- CreateIndex
CREATE INDEX "JobEvent_jobId_idx" ON "JobEvent"("jobId");

-- CreateIndex
CREATE INDEX "JobChangeRequest_jobId_idx" ON "JobChangeRequest"("jobId");

-- CreateIndex
CREATE INDEX "Application_jobId_createdAt_idx" ON "Application"("jobId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_email_whatsapp_key" ON "Application"("jobId", "email", "whatsapp");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_idx" ON "ApplicationEvent"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationNote_applicationId_idx" ON "ApplicationNote"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationMedia_applicationId_kind_idx" ON "ApplicationMedia"("applicationId", "kind");

-- CreateIndex
CREATE INDEX "ApplicationMedia_status_idx" ON "ApplicationMedia"("status");

-- CreateIndex
CREATE INDEX "MediaModerationLog_mediaId_idx" ON "MediaModerationLog"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaRedoLink_tokenHash_key" ON "MediaRedoLink"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_event_channel_lang_key" ON "MessageTemplate"("event", "channel", "lang");

-- CreateIndex
CREATE INDEX "Message_applicationId_idx" ON "Message"("applicationId");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "Pack_companyId_idx" ON "Pack"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsContent_groupKey_lang_key" ON "CmsContent"("groupKey", "lang");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "RefreshToken_companyUserId_idx" ON "RefreshToken"("companyUserId");

-- CreateIndex
CREATE INDEX "RefreshToken_staffUserId_idx" ON "RefreshToken"("staffUserId");

-- AddForeignKey
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "Wilaya"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCompanyId_fkey" FOREIGN KEY ("convertedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "Wilaya"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChangeRequest" ADD CONSTRAINT "JobChangeRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChangeRequest" ADD CONSTRAINT "JobChangeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "CompanyUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChangeRequest" ADD CONSTRAINT "JobChangeRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMedia" ADD CONSTRAINT "ApplicationMedia_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaModerationLog" ADD CONSTRAINT "MediaModerationLog_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "ApplicationMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaModerationLog" ADD CONSTRAINT "MediaModerationLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRedoLink" ADD CONSTRAINT "MediaRedoLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDossier" ADD CONSTRAINT "AiDossier_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

