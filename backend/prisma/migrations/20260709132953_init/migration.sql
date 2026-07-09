/*
  Warnings:

  - You are about to drop the column `nome` on the `vereadores` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cpf]` on the table `vereadores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `vereadores` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cargo` to the `vereadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cpf` to the `vereadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataNascimento` to the `vereadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nomeCompleto` to the `vereadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nomeEleitoral` to the `vereadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nomeMae` to the `vereadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senha` to the `vereadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `vereadores` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "vereadores" DROP COLUMN "nome",
ADD COLUMN     "cargo" TEXT NOT NULL,
ADD COLUMN     "cpf" TEXT NOT NULL,
ADD COLUMN     "dataNascimento" TEXT NOT NULL,
ADD COLUMN     "foto" TEXT,
ADD COLUMN     "nomeCompleto" TEXT NOT NULL,
ADD COLUMN     "nomeEleitoral" TEXT NOT NULL,
ADD COLUMN     "nomeMae" TEXT NOT NULL,
ADD COLUMN     "pedidoFala" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "senha" TEXT NOT NULL,
ADD COLUMN     "sigla" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Ausente',
ADD COLUMN     "username" TEXT NOT NULL,
ADD COLUMN     "voto" TEXT NOT NULL DEFAULT 'Aguardando',
ALTER COLUMN "partido" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "vereadores_cpf_key" ON "vereadores"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "vereadores_username_key" ON "vereadores"("username");
