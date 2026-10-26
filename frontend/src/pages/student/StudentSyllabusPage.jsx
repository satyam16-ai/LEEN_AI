import { BookOpenText, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/dashboard';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  EmptyState,
  Spinner,
} from '@/components/ui';
import {
  SubjectList,
  SYLLABUS_STATUS,
  SyllabusUpload,
  TopicPages,
  TopicTreeEditor,
  useSaveSyllabus,
  useSubjectPages,
  useSyllabus,
  useSyllabusSubjects,
  useUploadSyllabus,
} from '@/features/syllabus';
import { getApiError } from '@/utils/apiError';

function Reading() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-6">
        <Spinner />
        <div>
          <p className="font-medium">Reading your contents page…</p>
          <p className="text-sm text-muted-foreground">This usually takes under a minute.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SubjectSyllabus({ subject }) {
  const query = useSyllabus(subject);
  const save = useSaveSyllabus(subject);
  const upload = useUploadSyllabus(subject);
  const pages = useSubjectPages(subject);
  const [typing, setTyping] = useState(false);
  const [replacing, setReplacing] = useState(false);

  if (query.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (query.isError) {
    return <Alert variant="destructive">{getApiError(query.error).message}</Alert>;
  }

  const tree = query.data;
  const status = SYLLABUS_STATUS[tree.status] ?? SYLLABUS_STATUS.empty;
  const pagesFor = (topicId) => (pages.data ?? []).filter((page) => page.topic_id === topicId);
  const unfiled = pagesFor(null);

  const handleUpload = async (files) => {
    try {
      await upload.mutateAsync(files);
      setReplacing(false);
      setTyping(false);
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };
  const handleSave = async (body) => {
    try {
      await save.mutateAsync(body);
      setTyping(false);
      toast.success(body.confirm ? 'Syllabus confirmed' : 'Syllabus saved');
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };

  const needsUpload = ['empty', 'failed'].includes(tree.status) && !typing;
  let body;
  if (tree.status === 'reading') {
    body = <Reading />;
  } else if (needsUpload || replacing) {
    body = (
      <Card>
        <CardContent className="space-y-4 p-6">
          {tree.status === 'failed' && <Alert variant="destructive">{tree.error}</Alert>}
          <div className="space-y-1">
            <p className="font-medium">Photograph the contents page of your {subject} book</p>
            <p className="text-sm text-muted-foreground">
              Up to 3 photos, or one PDF. Your AI teacher reads the chapters and topics, and you
              check them before anything is planned.
            </p>
          </div>
          <SyllabusUpload
            onUpload={handleUpload}
            uploading={upload.isPending}
            onTypeIt={replacing ? null : () => setTyping(true)}
          />
          {replacing && (
            <Button variant="ghost" size="sm" onClick={() => setReplacing(false)}>
              Keep the current syllabus
            </Button>
          )}
        </CardContent>
      </Card>
    );
  } else {
    body = (
      <div className="space-y-6">
        {tree.status === 'draft' && (
          <Alert>Check the chapters and topics, fix anything that's wrong, then confirm.</Alert>
        )}
        <TopicTreeEditor
          key={query.dataUpdatedAt}
          chapters={tree.chapters}
          onSave={handleSave}
          saving={save.isPending}
          renderTopic={(topic) => (
            <TopicPages subject={subject} topic={topic} pages={pagesFor(topic.id)} />
          )}
        />
        {unfiled.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Other pages</h3>
            <TopicPages subject={subject} pages={unfiled} label="Add a page" />
          </section>
        )}
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm">
              <RefreshCw className="size-4" aria-hidden="true" />
              Read a new contents page
            </Button>
          }
          title="Read a new contents page?"
          description={
            'The new chapters and topics replace these. Pages you added stay in your library.'
          }
          confirmLabel="Choose a photo"
          onConfirm={() => setReplacing(true)}
        />
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="subject-heading">
      <div className="flex items-center gap-2">
        <h2 id="subject-heading" className="text-lg font-bold">
          {subject}
        </h2>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      {body}
    </section>
  );
}

export function StudentSyllabusPage() {
  const { subject: param } = useParams();
  const subjects = useSyllabusSubjects();
  const list = subjects.data ?? [];
  const active = param ?? list[0]?.subject ?? null;

  return (
    <>
      <PageHeader
        title="Syllabus"
        description={
          "Add each subject's contents page once. Your AI teacher plans and teaches from it."
        }
      />
      {subjects.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !list.length ? (
        <EmptyState
          icon={BookOpenText}
          title="No subjects yet"
          description="Add your subjects to your learning profile first."
          action={
            <Button asChild>
              <Link to="/student/onboarding">Edit learning profile</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
          <SubjectList subjects={list} active={active} />
          {active && <SubjectSyllabus key={active} subject={active} />}
        </div>
      )}
    </>
  );
}
