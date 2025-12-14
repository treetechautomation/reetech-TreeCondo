# Validação da Arquitetura e Pontos Críticos - TreeCondo

Este documento serve como uma análise técnica da arquitetura atual do Firestore para identificar pontos de fragilidade, documentos obrigatórios e boas práticas para evitar erros.

---

### 1. O que pode quebrar? (Pontos de Fragilidade)

A arquitetura se baseia em referências e índices que precisam estar consistentes. A quebra geralmente ocorre por "referências quebradas" ou dados faltantes.

*   **Se `userCondominios/{uid}/vinculos/{condominioId}` faltar:**
    *   **Impacto:** Crítico. O usuário não verá o condomínio no seletor. Se for o único vínculo, o usuário não poderá fazer absolutamente nada na aplicação.
    *   **Cenário:** Um Super Admin remove um usuário de um condomínio mas esquece de deletar o vínculo correspondente no índice.

*   **Se `condominios/{condominioId}` for deletado, mas o `vinculo` ainda existir:**
    *   **Impacto:** Alto. O condomínio aparecerá no seletor (pois vem do `vinculo`), mas qualquer tentativa de ler seus dados (blocos, membros, etc.) resultará em erro ou em listas vazias.
    *   **Cenário:** Exclusão manual do condomínio sem a devida limpeza dos vínculos de todos os usuários associados.

*   **Se `condominios/{condominioId}/membros/{uid}` faltar para um Síndico/Porteiro:**
    *   **Impacto:** Crítico para esse usuário. As regras de segurança (`isCondoStaff`) falharão. O usuário conseguirá selecionar o condomínio, mas receberá `permission denied` para todas as operações internas que dependem do seu papel de staff.
    *   **Cenário:** Um usuário é definido com `role: "SINDICO"` no `vinculo`, mas o documento correspondente em `membros` não é criado.

*   **Se um `bloco` ou `unidade` for deletado, mas um `vinculo` de morador ainda apontar para ele:**
    *   **Impacto:** Crítico para o morador. A aplicação tentará buscar dados de um caminho inexistente (`.../blocos/{blocoId}/unidades/{unidadeId}`), resultando em erros ou comportamento inesperado.

---

### 2. Documentos Obrigatórios para o App Funcionar

Para que a experiência de um usuário seja funcional, a seguinte cadeia de documentos **deve** existir:

1.  **Para Login e Acesso Básico:**
    *   `Firebase Auth User`: O registro do usuário no Firebase Authentication.
    *   `userCondominios/{uid}`: Documento raiz para o usuário.
    *   `userCondominios/{uid}/vinculos/{condominioId}`: **O MAIS CRÍTICO.** Sem este documento, o usuário não tem identidade dentro do ecossistema de condomínios.

2.  **Para Acesso de Staff (Síndico/Porteiro):**
    *   Todos os documentos do item 1.
    *   `condominios/{condominioId}`: O documento principal do condomínio.
    *   `condominios/{condominioId}/membros/{uid}`: Documento que valida o papel (`role`) e o status do membro para as regras de segurança.

3.  **Para Acesso de Morador:**
    *   Todos os documentos do item 1.
    *   O `vinculo` **deve** conter `blocoId` e `unidadeId` válidos.
    *   `condominios/{condominioId}`
    *   `condominios/{condominioId}/blocos/{blocoId}`
    *   `condominios/{condominioId}/blocos/{blocoId}/unidades/{unidadeId}`
    *   `condominios/{condominioId}/blocos/{blocoId}/unidades/{unidadeId}/moradores/{uid}`: Confirma que o morador pertence de fato àquela unidade.

**Resumo:** A criação de um condomínio e a associação de um usuário devem ser tratadas como **transações atômicas**. Nosso script `criarCondominio` já segue essa boa prática, garantindo que todos os documentos necessários sejam criados juntos.

---

### 3. Boas Práticas para Evitar "Permission Denied"

Os erros de permissão geralmente derivam de uma inconsistência entre o que a aplicação *pensa* que o usuário é e o que as regras de segurança *validam* que ele é.

1.  **Garantir a Dupla Validação:** As regras de segurança dependem de dados em locais diferentes para validar um papel.
    *   Para **Síndico/Porteiro**, as regras checam `.../membros/{uid}`.
    *   Para **Morador**, as regras checam o `vinculo` em `userCondominios`.
    *   **Prática:** Nunca crie ou atualize um `vinculo` sem garantir que a fonte da verdade (`membros` para staff) seja criada ou atualizada simultaneamente. **Use `WriteBatch` ou `Transaction`** para essas operações.

2.  **Restringir a Escrita de Estrutura:** Como já fizemos nas regras, a criação/edição de `condominios`, `blocos` e `unidades` deve ser **exclusiva do Super Admin**. Isso evita que um Síndico, por engano, delete um bloco e invalide o acesso de dezenas de moradores.

3.  **Centralizar a Lógica de Permissão nas Regras:** A aplicação cliente não deve ter lógicas como `if (user.role === 'SINDICO') { showButton() }`. Em vez disso, a UI deve tentar realizar a ação (ex: buscar dados que só síndico pode ver), e as regras de segurança do Firestore bloquearão ou permitirão. A UI deve reagir a um sucesso ou falha de leitura/escrita, e não prever a permissão. Nossos hooks `useCollection` e `useDoc` já lidam com o erro de permissão, o que facilita essa abordagem.

4.  **Consistência no `role`:** O campo `role` deve ser idêntico no `vinculo` e, se aplicável, no documento de `membros`. Um `role` "SINDICO" no vínculo e "sindico" (minúsculo) no membro causará falha de permissão. Padronizar o uso de `enum` ou constantes no código da aplicação é uma boa prática.
