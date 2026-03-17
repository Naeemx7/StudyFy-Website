import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { WorkspaceComponent } from './workspace';
import { StorageService } from '../../services/storage.service';
import { AiService } from '../../services/ai.service';

describe('WorkspaceComponent', () => {
  let component: WorkspaceComponent;
  let fixture: ComponentFixture<WorkspaceComponent>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [WorkspaceComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ spaceId: 'space-1', fileName: 'lesson.pdf' }),
            },
          },
        },
        {
          provide: Router,
          useValue: router,
        },
        {
          provide: StorageService,
          useValue: {
            getFileContent: () => of({ fileId: '123e4567-e89b-12d3-a456-426614174000', result: 'Document body' }),
          },
        },
        {
          provide: AiService,
          useValue: {
            generateSummary: () => of({ responseTitle: 'Summary', responseContent: 'Summary content' }),
            generateFlashcards: () => of({ responseTitle: 'Flashcards', responseContent: [] }),
            generateQuiz: () => of({
              quizId: 'quiz-1',
              workSpaceId: 'space-1',
              userId: 'user-1',
              operationResponse: {
                responseTitle: 'Quiz',
                responseContent: [{
                  question: 'What is AI?',
                  options: ['A field of study', 'A fruit'],
                  correctAnswer: 'A field of study',
                }],
              },
            }),
            submitQuiz: () => of({ isSuccess: true, message: 'ok' }),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to the summary tab', () => {
    expect(component.activeTab).toBe('summary');
    expect(component.summaryContent).toBe('Summary content');
  });
});
