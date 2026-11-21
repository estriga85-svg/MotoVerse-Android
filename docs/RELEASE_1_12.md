# MotoVerse 1.12 — funcionalidades e verificação

## Novidades incluídas na APK
- Mercado: mostra anúncios do Firestore com estado `approved`, com pesquisa, filtros, ordenação, galeria, contacto com vendedor, favoritos, partilha e denúncia por e-mail.
- Guia de compra segura e checklist por anúncio (guardada localmente).
- Garagem: histórico de manutenção, abastecimentos, custos, consumo estimado entre dois depósitos completos, datas importantes e exportação CSV via seletor de ficheiros Android.
- Comunidade: encontros reais guardados no Firestore, filtros, localização em Maps e planeador de percurso.
- Oficinas, concessionários e peças: pesquisa externa real via Google Maps em vez de empresas fictícias.
- Conta: confirmação de e-mail e acesso administrativo condicionado a e-mail confirmado.
- Checklist pré-viagem (guardada localmente, reiniciada por data).

## O que requer configuração externa
1. **Regras Firestore:** o ficheiro `firestore.rules` no GitHub **não é publicado automaticamente** na base de dados. No [Firebase Console](https://console.firebase.google.com/) abrir o projeto MotoVerse, **Firestore Database → Rules**, rever as regras e carregar em **Publish**. É indispensável testar com duas contas diferentes antes de disponibilizar a aplicação ao público.
2. Alternativa CLI: adicionar o projeto com `firebase use --add` e executar `firebase deploy --only firestore:rules` a partir da raiz do repositório. O `firebase.json` aponta para o ficheiro correto.
3. **Autenticação:** manter os fornecedores E-mail/Palavra-passe e Google configurados. Para login Google em builds de teste pode ser necessário registar o SHA-1 da chave utilizada para assinar a APK.
4. **Alertas:** o webhook de e-mail, as notificações em segundo plano e as permissões Android devem ser testados em dispositivo real; não está garantido envio imediato.
5. **Revisão:** a aprovação de anúncios deve ser validada contra regras Firestore publicadas, não apenas contra verificações de interface.

## Testes de aceitação sugeridos
- A APK abre e permite escrever no login e tocar nos botões.
- Uma conta nova consegue confirmar o e-mail, adicionar mota e registar duas revisões; após voltar a entrar, o histórico mantém-se.
- Uma segunda conta não consegue ler favoritos, histórico ou conversas da primeira.
- Um anúncio recém-enviado fica em revisão e não aparece publicamente; depois da aprovação surge na pesquisa.
- Uma conta distinta consegue contactar o vendedor; as mensagens surgem em ambas as contas.
- Um encontro publicado aparece na Comunidade e na página inicial.
- O seletor CSV grava um ficheiro que abre no Excel.
- A pesquisa de serviços e o planeador abrem o Google Maps.

## Antes de publicar na Google Play
Ainda são necessários: regras efetivamente publicadas e testadas, política de privacidade baseada no tratamento real de dados, uma versão AAB assinada para produção, revisão de segurança dos uploads de imagens e das informações pessoais dos anunciantes. **Não publicar a APK de debug como versão final.**
