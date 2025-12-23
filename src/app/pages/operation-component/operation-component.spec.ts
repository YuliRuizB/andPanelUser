import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OperationComponent } from './operation-component';

describe('OperationComponent', () => {
  let component: OperationComponent;
  let fixture: ComponentFixture<OperationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OperationComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
