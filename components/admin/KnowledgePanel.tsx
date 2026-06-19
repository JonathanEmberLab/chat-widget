'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Segmented,
  Input,
  Button,
  Space,
  Typography,
  List,
  Tag,
  Popconfirm,
  Upload,
  Empty,
  Spin,
  Modal,
  Card,
  Alert,
  Avatar,
  App,
} from 'antd';
import {
  FileText,
  Link2,
  UploadCloud,
  Trash2,
  Eye,
  Pencil,
  LayoutTemplate,
  Paperclip,
  ArrowLeft,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { SiteConfig, KnowledgeDoc, KnowledgeSourceType } from '@/lib/types';
import type { AdminApi } from '@/lib/admin-api';
import { TEMPLATE_META, type TemplateId } from '@/lib/knowledge-templates';
import KnowledgeTemplateForm from './KnowledgeTemplateForm';
import { formatDateTime } from './shared';

interface Props {
  site: SiteConfig;
  api: AdminApi;
  onBack: () => void;
}

const SOURCE_META: Record<KnowledgeSourceType, { color: string; hex: string; label: string; icon: React.ReactNode }> = {
  template: { color: 'gold', hex: '#d48806', label: 'Plantilla', icon: <LayoutTemplate size={18} /> },
  text: { color: 'blue', hex: '#1677ff', label: 'Texto', icon: <FileText size={18} /> },
  file: { color: 'purple', hex: '#722ed1', label: 'Archivo', icon: <Paperclip size={18} /> },
  url: { color: 'green', hex: '#389e0d', label: 'URL', icon: <Link2 size={18} /> },
};

const MODE_HELP: Record<Mode, string> = {
  template: 'Llena un formulario guiado (horarios, ubicación, precios, FAQ…). Se guarda estructurado y lo puedes editar cuando quieras.',
  text: 'Pega información del negocio o preguntas frecuentes como texto libre.',
  file: 'Sube un documento y extraemos su texto automáticamente.',
  url: 'Pega la dirección de una página y descargamos su contenido.',
};

const ACCEPTED_FILES = ['PDF', 'DOCX', 'TXT', 'MD', 'CSV'];

type Mode = 'template' | 'text' | 'file' | 'url';

function sizeLabel(chars: number): string {
  return chars > 1000 ? `${Math.round(chars / 1000)}k caracteres` : `${chars} caracteres`;
}

/** Strip markdown noise for a clean one-glance preview. */
function preview(content: string): string {
  return content
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export default function KnowledgePanel({ site, api, onBack }: Props) {
  const { message } = App.useApp();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>('template');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [viewing, setViewing] = useState<KnowledgeDoc | null>(null);

  // Which existing doc is being edited (template form or text editor), if any.
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  // Which blank template is picked when creating a new one.
  const [tplPick, setTplPick] = useState<TemplateId | null>(null);

  const resetForms = useCallback(() => {
    setTitle('');
    setContent('');
    setUrl('');
    setTplPick(null);
    setEditingDoc(null);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await api.listKnowledge(site.site_key));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [api, site, message]);

  useEffect(() => {
    reload();
    setMode('template');
    resetForms();
  }, [reload, resetForms]);

  function switchMode(m: Mode) {
    setMode(m);
    resetForms();
  }

  async function saveText() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      if (editingDoc) {
        await api.updateKnowledgeText(site.site_key, editingDoc.id, { title, content });
        message.success('Contenido actualizado');
      } else {
        await api.addKnowledgeText(site.site_key, { source_type: 'text', title, content });
        message.success('Contenido agregado');
      }
      resetForms();
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function addUrl() {
    if (!url.trim()) return;
    setSaving(true);
    try {
      await api.addKnowledgeText(site.site_key, { source_type: 'url', url, title });
      message.success('URL procesada');
      resetForms();
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'No se pudo procesar la URL');
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File): Promise<boolean> {
    setSaving(true);
    try {
      await api.addKnowledgeFile(site.site_key, file);
      message.success(`"${file.name}" procesado`);
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'No se pudo procesar el archivo');
    } finally {
      setSaving(false);
    }
    return false; // prevent antd's default upload
  }

  async function saveTemplate(tplTitle: string, data: Record<string, unknown>) {
    const templateId = editingDoc?.template ?? tplPick;
    if (!templateId) return;
    setSaving(true);
    try {
      if (editingDoc) {
        await api.updateKnowledgeTemplate(site.site_key, editingDoc.id, { template: templateId, title: tplTitle, data });
        message.success('Plantilla actualizada');
      } else {
        await api.addKnowledgeTemplate(site.site_key, { template: templateId, title: tplTitle, data });
        message.success('Plantilla agregada');
      }
      resetForms();
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function editDoc(doc: KnowledgeDoc) {
    if (doc.source_type === 'template') {
      setMode('template');
      setTplPick(null);
      setEditingDoc(doc);
    } else {
      setMode('text');
      setTplPick(null);
      setEditingDoc(doc);
      setTitle(doc.title);
      setContent(doc.content);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id: number) {
    try {
      await api.deleteKnowledge(site.site_key, id);
      message.success('Documento eliminado');
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  const activeTemplate = editingDoc?.template ?? tplPick;
  const editingText = editingDoc && editingDoc.source_type !== 'template';

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeft size={16} />} onClick={onBack}>Volver</Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Base de conocimiento — {site.name}
        </Typography.Title>
      </div>

      <Card
        title={editingDoc ? 'Editar contenido' : 'Agregar contenido'}
        style={{ marginBottom: 24 }}
      >
        {!editingDoc && (
          <Segmented
            block
            value={mode}
            onChange={(v) => switchMode(v as Mode)}
            options={[
              { label: 'Plantilla', value: 'template', icon: <LayoutTemplate size={15} /> },
              { label: 'Texto', value: 'text', icon: <FileText size={15} /> },
              { label: 'Archivo', value: 'file', icon: <UploadCloud size={15} /> },
              { label: 'URL', value: 'url', icon: <Link2 size={15} /> },
            ]}
            style={{ marginBottom: 12, maxWidth: 480 }}
          />
        )}

        {!editingDoc && (
          <Alert type="info" showIcon title={MODE_HELP[mode]} style={{ marginBottom: 16 }} />
        )}

        {mode === 'template' && !activeTemplate && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {TEMPLATE_META.map((t) => (
              <Card key={t.id} size="small" hoverable onClick={() => setTplPick(t.id)} styles={{ body: { padding: 14 } }}>
                <Typography.Text strong>{t.label}</Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.description}</Typography.Text>
                </div>
              </Card>
            ))}
          </div>
        )}

        {mode === 'template' && activeTemplate && (
          <div style={{ maxWidth: 560 }}>
            <KnowledgeTemplateForm
              key={editingDoc ? `edit-${editingDoc.id}` : `new-${activeTemplate}`}
              templateId={activeTemplate as TemplateId}
              editing={!!editingDoc}
              initialTitle={editingDoc?.title}
              initialData={editingDoc?.data ?? undefined}
              saving={saving}
              onSave={saveTemplate}
              onCancel={resetForms}
            />
          </div>
        )}

        {mode === 'text' && (
          <Space direction="vertical" style={{ width: '100%', maxWidth: 640 }} size="small">
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Título</Typography.Text>
              <Input placeholder="Ej. Políticas de cancelación" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Contenido</Typography.Text>
              <Input.TextArea
                rows={editingText ? 14 : 8}
                placeholder="Pega aquí información del negocio, preguntas frecuentes, precios, políticas…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <Space>
              <Button type="primary" loading={saving} disabled={!content.trim()} onClick={saveText}>
                {editingDoc ? 'Guardar cambios' : 'Agregar texto'}
              </Button>
              {editingDoc && <Button onClick={resetForms}>Cancelar</Button>}
            </Space>
          </Space>
        )}

        {mode === 'url' && (
          <Space direction="vertical" style={{ width: '100%', maxWidth: 560 }} size="small">
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Dirección de la página</Typography.Text>
              <Input placeholder="https://www.cliente.com/servicios" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Título (opcional)</Typography.Text>
              <Input placeholder="Se usa el título de la página si lo dejas vacío" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <Button type="primary" loading={saving} disabled={!url.trim()} onClick={addUrl}>
              Procesar URL
            </Button>
          </Space>
        )}

        {mode === 'file' && (
          <div style={{ maxWidth: 560 }}>
            <Upload.Dragger
              multiple
              showUploadList={false}
              accept=".pdf,.docx,.txt,.md,.csv"
              beforeUpload={(file) => uploadFile(file as File)}
              disabled={saving}
              style={{ padding: '24px 0' }}
            >
              <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
                {saving ? <Spin /> : <UploadCloud size={40} color="#b3a9c9" strokeWidth={1.5} />}
              </p>
              <p className="ant-upload-text" style={{ fontWeight: 600 }}>
                {saving ? 'Procesando…' : 'Arrastra tus archivos aquí'}
              </p>
              <p className="ant-upload-hint" style={{ margin: 0 }}>o haz clic para seleccionarlos</p>
            </Upload.Dragger>
            <div style={{ marginTop: 12 }}>
              <Space size={4} wrap>
                {ACCEPTED_FILES.map((f) => <Tag key={f}>{f}</Tag>)}
              </Space>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                Solo guardamos el <strong>texto</strong> extraído del archivo, no el archivo original.
              </Typography.Paragraph>
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 4px 12px' }}>
        <Typography.Title level={5} style={{ margin: 0 }}>Contenido actual</Typography.Title>
        <Typography.Text type="secondary">{docs.length} {docs.length === 1 ? 'elemento' : 'elementos'}</Typography.Text>
      </div>

      <Card styles={{ body: { padding: docs.length ? '0 24px' : 24 } }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : docs.length === 0 ? (
          <Empty description="Sin contenido todavía. Agrega tu primer documento arriba." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={docs}
            renderItem={(doc) => {
              const meta = SOURCE_META[doc.source_type];
              return (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar shape="square" style={{ background: `${meta.hex}1a`, color: meta.hex }} icon={meta.icon} />}
                    title={
                      <Space size={6}>
                        <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>{meta.label}</Tag>
                        {doc.source_url ? (
                          <a href={doc.source_url} target="_blank" rel="noreferrer">{doc.title}</a>
                        ) : (
                          <span>{doc.title}</span>
                        )}
                      </Space>
                    }
                    description={
                      <>
                        <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 12, margin: '2px 0' }}>
                          {preview(doc.content)}
                        </Typography.Paragraph>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {sizeLabel(doc.chars)} · {formatDateTime(doc.created_at)}
                        </Typography.Text>
                        <div style={{ marginTop: 8 }}>
                          <Space size={4}>
                            <Button size="small" icon={<Eye size={14} />} onClick={() => setViewing(doc)}>Ver</Button>
                            <Button size="small" icon={<Pencil size={14} />} onClick={() => editDoc(doc)}>Editar</Button>
                            <Popconfirm
                              title="¿Eliminar este documento?"
                              okText="Eliminar"
                              okButtonProps={{ danger: true }}
                              cancelText="Cancelar"
                              onConfirm={() => remove(doc.id)}
                            >
                              <Button size="small" danger icon={<Trash2 size={14} />}>Eliminar</Button>
                            </Popconfirm>
                          </Space>
                        </div>
                      </>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Modal title={viewing?.title} open={!!viewing} onCancel={() => setViewing(null)} footer={null} width={680}>
        {viewing?.source_url && (
          <Typography.Paragraph>
            <a href={viewing.source_url} target="_blank" rel="noreferrer">{viewing.source_url}</a>
          </Typography.Paragraph>
        )}
        <div
          style={{
            maxHeight: '60vh',
            overflow: 'auto',
            wordBreak: 'break-word',
            fontSize: 13,
            lineHeight: 1.6,
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            padding: 16,
            ...(viewing?.source_type === 'template' ? {} : { whiteSpace: 'pre-wrap' }),
          }}
        >
          {viewing?.source_type === 'template' ? (
            <ReactMarkdown>{viewing.content}</ReactMarkdown>
          ) : (
            viewing?.content
          )}
        </div>
      </Modal>
    </div>
  );
}