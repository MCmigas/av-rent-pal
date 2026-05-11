import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components'

interface Props { siteName: string; oldEmail: string; email: string; newEmail: string; confirmationUrl: string }

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Confirme a alteração de email — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}><Text style={brand}>{siteName}</Text></Section>
        <Heading style={h1}>Confirmar novo email</Heading>
        <Text style={text}>Pediu para alterar o email da sua conta na {siteName} de <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link> para <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.</Text>
        <Button style={button} href={confirmationUrl}>Confirmar alteração</Button>
        <Text style={footer}>Se não fez este pedido, proteja a sua conta imediatamente.</Text>
      </Container>
    </Body>
  </Html>
)
export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brandBar = { borderBottom: '3px solid #E8B923', paddingBottom: '12px', marginBottom: '24px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: '#1a1a1a', textDecoration: 'underline' }
const button = { backgroundColor: '#1a1a1a', color: '#E8B923', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block', margin: '8px 0 24px' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
