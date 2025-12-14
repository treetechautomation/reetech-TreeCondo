# Checklist Operacional para Criação de Novo Condomínio (Manual)

Este documento descreve os passos que um Super Admin deve seguir para cadastrar um novo condomínio manualmente no console do Firebase Firestore, garantindo que a estrutura de dados e as permissões sejam criadas corretamente.

**UID do Super Admin:** O UID do usuário que está realizando a operação.

---

### Passo 1: Criar o Documento do Condomínio

1.  Navegue até a coleção `condominios`.
2.  Clique em "Adicionar documento" e gere um ID automático. Anote este `condominioId`.
3.  Preencha os campos do documento:
    *   `nome`: `String` (Ex: "Residencial Bosque Verde")
    *   `cnpj`: `String` (Opcional)
    *   `cep`: `String` (Opcional)
    *   `ativo`: `Boolean` (Definir como `true`)
    *   `createdAt`: `Timestamp` (Use o valor atual do servidor)
    *   `createdBy`: `String` (UID do Super Admin)

### Passo 2: Criar o Bloco e a Unidade Iniciais

1.  Dentro do documento do condomínio criado (`/condominios/{condominioId}`), inicie a subcoleção `blocos`.
2.  Clique em "Adicionar documento" e gere um ID automático. Anote este `blocoId`.
3.  Preencha os campos do documento do bloco:
    *   `nome`: `String` (Ex: "Bloco A" ou "Bloco Padrão")
    *   `ordem`: `Number` (Ex: `1`)
    *   `ativo`: `Boolean` (Definir como `true`)
    *   `createdAt`: `Timestamp` (Use o valor atual do servidor)
4.  Dentro do documento do bloco criado (`.../blocos/{blocoId}`), inicie a subcoleção `unidades`.
5.  Clique em "Adicionar documento" e gere um ID automático. Anote este `unidadeId`.
6.  Preencha os campos do documento da unidade:
    *   `numero`: `String` (Ex: "101")
    *   `andar`: `Number` (Ex: `1`)
    *   `tipo`: `String` (Definir como "APARTAMENTO")
    *   `ativo`: `Boolean` (Definir como `true`)
    *   `createdAt`: `Timestamp` (Use o valor atual do servidor)

### Passo 3: Criar a Configuração de Menu

1.  Dentro do documento do condomínio (`/condominios/{condominioId}`), inicie a subcoleção `config`.
2.  Crie um documento com o ID **manual** `menu`.
3.  Adicione os campos `sindico`, `morador` e `porteiro`, cada um do tipo `map`.
4.  Dentro de cada mapa, adicione os campos dos módulos (`anuncios`, `reservas`, etc.) com seus respectivos valores `Boolean` conforme o padrão de permissão.

### Passo 4: Adicionar o Síndico ou Responsável

1.  Identifique o UID do usuário que será o Síndico (pode ser o próprio Super Admin).
2.  Dentro do documento do condomínio (`/condominios/{condominioId}`), navegue até a subcoleção `membros`.
3.  Crie um novo documento usando o **UID do síndico** como ID do documento.
4.  Preencha os campos:
    *   `role`: `String` (Definir como "SINDICO")
    *   `status`: `String` (Definir como "ATIVO")
    *   `createdAt`: `Timestamp` (Use o valor atual do servidor)
    *   `createdBy`: `String` (UID do Super Admin)

### Passo 5: Criar o Vínculo de Acesso para o Síndico

1.  Navegue até a coleção `userCondominios`.
2.  Encontre ou crie o documento cujo ID é o **UID do síndico** do passo anterior.
3.  Dentro deste documento, inicie a subcoleção `vinculos`.
4.  Crie um novo documento usando o **`condominioId`** do Passo 1 como ID do documento.
5.  Preencha os campos do vínculo:
    *   `condominioId`: `String` (Repetir o `condominioId`)
    *   `condominioNome`: `String` (Nome do condomínio do Passo 1)
    *   `role`: `String` (Definir como "SINDICO")
    *   `status`: `String` (Definir como "ATIVO")
    *   *Não adicione `blocoId` ou `unidadeId` para papéis que não são "MORADOR".*

---

Ao final desses 5 passos, o condomínio estará totalmente configurado, com sua estrutura mínima criada e um administrador (Síndico) devidamente associado e com permissão de acesso.
