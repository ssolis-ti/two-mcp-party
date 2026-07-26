# FEAT-010: Handshake V2 y Anti-Looping Inteligente

## Metadata

| Campo | Valor |
|-------|-------|
| **ID** | FEAT-010 |
| **Autor** | Antigravity / Hermes |
| **Fecha** | 2026-07-26 |
| **Estado** | 🟢 Aprobada |
| **Prioridad** | 🔴 Crítica |
| **Plan Técnico** | `plans/PLAN-010-handshake-antiloop.md` |

---

## 📋 Resumen

Implementar la base arquitectónica V2.6.0 para AgentBridge, introduciendo un mensaje automático del sistema al unirse a la sesión (Handshake V2) y un sistema anti-looping de alto rendimiento con memoria RAM y log a base de datos.

## 🎯 Objetivos

### Objetivo Principal
- [ ] Prevenir bloqueos infinitos de agentes debido a Tool Calls fallidas repetitivas.

### Objetivos Secundarios
- [ ] Dar visibilidad del estado de la sesión a los participantes recién conectados.
- [ ] Evitar saturar el disco (I/O) guardando el historial de tools temporalmente en memoria.

## 👤 Usuarios Objetivo

| Persona | Descripción | Necesidad Principal |
|---------|-------------|---------------------|
| Agente IA | Cliente conectándose al Hub | Recibir contexto y evitar entrar en bucles de error. |

## 📖 User Stories

### US-001: Handshake
**Como** Agente IA
**Quiero** recibir un resumen de quién está en la sala apenas me uno
**Para** no tener que gastar un turno preguntando

**Criterios de Aceptación:**
- [ ] El servidor emite un mensaje type="system" con los participantes.
- [ ] El mensaje no descuenta tokens/turn_count.

### US-002: Anti-Looping
**Como** Hub AgentBridge
**Quiero** detectar cuando un agente repite una llamada a una tool
**Para** abortar el intento e inyectar un mensaje de error crítico

**Criterios de Aceptación:**
- [ ] Mantener las últimas 20 llamadas por agente.
- [ ] Detectar misma tool + mismos args, o 5 veces la misma tool con args diferentes.
- [ ] Registrar loops severos en SQLite.

## ⚠️ Restricciones

- Mantener la latencia de mensajería (I/O) lo más baja posible (RAM priority).

## 📊 Métricas de Éxito

| Métrica | Objetivo | Cómo se Mide |
|---------|----------|--------------|
| Loops Detectados | > 0 | Logs de la tabla loop_events |

---

> **Recordatorio**: Esta spec debe ser aprobada antes de crear el plan técnico.
