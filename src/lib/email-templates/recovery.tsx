import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

interface Props { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Recuperação de palavra-passe — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}><Text style={brand}>{siteName}</Text></Section>
        <Heading style={h1}>Recuperar palavra-passe</Heading>
        <Text style={text}>Recebemos um pedido para redefinir a palavra-passe da sua conta na {siteName}. Clique abaixo para escolher uma nova.</Text>
        <Button style={button} href={confirmationUrl}>Definir nova palavra-passe</Button>
        <Text style={footer}>Se não pediu esta recuperação, ignore este email — a sua palavra-passe não será alterada.</Text>
      </Container>
    </Body>
  </Html>
)
export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brandBar = { borderBottom: '3px solid #E8B923', paddingBottom: '12px', marginBottom: '24px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: '#1a1a1a', textDecoration: 'underline' }
const button = { backgroundColor: '#1a1a1a', color: '#E8B923', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block', margin: '8px 0 24px' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
