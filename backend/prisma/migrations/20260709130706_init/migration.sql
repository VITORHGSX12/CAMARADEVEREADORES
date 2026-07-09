-- CreateTable
CREATE TABLE "vereadores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "partido" TEXT NOT NULL,
    "votos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vereadores_pkey" PRIMARY KEY ("id")
);
