import React, { useEffect, useMemo, useState } from "react";
import {
  Play,
  Award,
  Clock,
  CheckCircle,
  Users,
  Brain,
  Code,
  Eye,
  Image,
  X,
  Settings,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Moon,
  Sun,
} from "lucide-react";
import { mockInterviews } from "../data/mockData";
import { api } from "../services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getApiUrl } from "../config/environment";

// Timer formatting helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const MockInterviews: React.FC = () => {
  const [interviews] = useState(mockInterviews);
  const [selectedInterview, setSelectedInterview] = useState<string | null>(
    null
  );
  const [isInInterview, setIsInInterview] = useState(false);
  const [techQuiz, setTechQuiz] = useState<{
    quiz: any;
    questions: any[];
  } | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Timer state
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  // Technical/Industry quiz UI state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<number[]>([]);
  const [scoreCorrect, setScoreCorrect] = useState(0);
  const [scoreTotal, setScoreTotal] = useState(0);
  const [finished, setFinished] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [modeLabel, setModeLabel] = useState<string>("Bash");

  // Behavioral responses keyed by index
  const [behavioralResponses, setBehavioralResponses] = useState<
    Record<number, string>
  >({});

  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const recordedVideoRef = React.useRef<HTMLVideoElement>(null);

  // Topic selection modal state
  const [showTopicModal, setShowTopicModal] = useState<
    false | "technical" | "industry"
  >(false);
  const [availableTopics, setAvailableTopics] = useState<
    Array<{
      topic_slug: string;
      topic_name: string;
      file: string;
      cached: boolean;
    }>
  >([]);

  // Image modal state
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState<string | null>(null);
  const [imageModalAlt, setImageModalAlt] = useState<string>("");
  const [imageModalError, setImageModalError] = useState(false);
  // Per-card topic selections
  const [techTopicSlug, setTechTopicSlug] = useState<string | null>(null);
  const [techTopicName, setTechTopicName] = useState<string | null>(null);
  const [industryTopicSlug, setIndustryTopicSlug] = useState<string | null>(
    null
  );
  const [industryTopicName, setIndustryTopicName] = useState<string | null>(
    null
  );
  const [skipNextFetch, setSkipNextFetch] = useState<boolean>(false);

  // Admin panel state
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [allTopics, setAllTopics] = useState<
    Array<{ slug: string; name: string; industry_specific: boolean }>
  >([]);
  const [reloadStatus, setReloadStatus] = useState<{
    loading: boolean;
    message: string | null;
  }>({ loading: false, message: null });
  const [categoryUpdates, setCategoryUpdates] = useState<
    Record<string, boolean>
  >({});

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  // User metrics/gamification state
  const [userMetrics, setUserMetrics] = useState<{
    technicalHighScore: number;
    industryHighScore: number;
    behavioralCompletions: number;
  }>({
    technicalHighScore: 0,
    industryHighScore: 0,
    behavioralCompletions: 0,
  });

  // Get or create user ID from localStorage
  const getUserId = (): string => {
    let userId = localStorage.getItem("quizUserId");
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("quizUserId", userId);
    }
    return userId;
  };

  // Get behavioral completion count from localStorage (tracks number of questions completed, max 5)
  const getBehavioralCompletions = (): number => {
    const saved = localStorage.getItem("behavioralCompletions");
    return saved ? parseInt(saved, 10) : 0;
  };

  // Get persisted high scores from localStorage
  const getPersistedScores = () => {
    const techScore = localStorage.getItem("technicalHighScore");
    const industryScore = localStorage.getItem("industryHighScore");
    return {
      technicalHighScore: techScore ? parseInt(techScore, 10) : 0,
      industryHighScore: industryScore ? parseInt(industryScore, 10) : 0,
    };
  };

  // Save high scores to localStorage
  const saveScoresToLocalStorage = (technical: number, industry: number) => {
    localStorage.setItem("technicalHighScore", String(technical));
    localStorage.setItem("industryHighScore", String(industry));
  };

  // Increment behavioral completion count (tracks completed questions out of 5)
  const incrementBehavioralCompletion = () => {
    const current = getBehavioralCompletions();
    const newCount = Math.min(current + 1, 5); // Cap at 5 questions
    localStorage.setItem("behavioralCompletions", String(newCount));
    setUserMetrics((prev) => ({ ...prev, behavioralCompletions: newCount }));
  };

  // Clear individual stats
  const clearTechnicalScore = () => {
    if (window.confirm("Clear your Tech Challenge high score?")) {
      localStorage.removeItem("technicalHighScore");
      setUserMetrics((prev) => ({ ...prev, technicalHighScore: 0 }));
    }
  };

  const clearIndustryScore = () => {
    if (window.confirm("Clear your Industry Tests high score?")) {
      localStorage.removeItem("industryHighScore");
      setUserMetrics((prev) => ({ ...prev, industryHighScore: 0 }));
    }
  };

  const clearBehavioralCompletions = () => {
    if (window.confirm("Clear your Mock Interview completion count?")) {
      localStorage.removeItem("behavioralCompletions");
      setUserMetrics((prev) => ({ ...prev, behavioralCompletions: 0 }));
    }
  };

  // Clear all stats from localStorage
  const clearAllStats = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all your session stats? This cannot be undone."
      )
    ) {
      localStorage.removeItem("behavioralCompletions");
      localStorage.removeItem("technicalHighScore");
      localStorage.removeItem("industryHighScore");
      setUserMetrics({
        technicalHighScore: 0,
        industryHighScore: 0,
        behavioralCompletions: 0,
      });
    }
  };

  // Fetch user metrics from backend and merge with localStorage (keep highest)
  const fetchUserMetrics = React.useCallback(async () => {
    // Load persisted scores first for immediate display
    const persisted = getPersistedScores();
    const behavioralCompletions = getBehavioralCompletions();

    // Set initial state from localStorage
    setUserMetrics({
      technicalHighScore: persisted.technicalHighScore,
      industryHighScore: persisted.industryHighScore,
      behavioralCompletions,
    });

    // Then fetch from backend and keep the highest score for each category
    try {
      const userId = getUserId();
      const metrics = await api.get<any>(
        `/quiz/metrics?user_id=${encodeURIComponent(userId)}`
      );
      console.log("[Metrics] Fetched metrics:", {
        technicalHighScore: metrics.technicalHighScore,
        industryHighScore: metrics.industryHighScore,
        behavioralCompletions,
        rawMetrics: metrics,
      });

      // Keep the highest score between localStorage and backend for each category
      const technicalHighScore = Math.max(
        persisted.technicalHighScore,
        Number(metrics.technicalHighScore) || 0
      );
      const industryHighScore = Math.max(
        persisted.industryHighScore,
        Number(metrics.industryHighScore) || 0
      );

      // Save the highest scores back to localStorage
      saveScoresToLocalStorage(technicalHighScore, industryHighScore);

      setUserMetrics({
        technicalHighScore,
        industryHighScore,
        behavioralCompletions,
      });
    } catch (e) {
      console.error("[Metrics] Failed to fetch:", e);
      // Keep localStorage values on error
      setUserMetrics({
        technicalHighScore: persisted.technicalHighScore,
        industryHighScore: persisted.industryHighScore,
        behavioralCompletions,
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Fetch metrics on component mount
  useEffect(() => {
    fetchUserMetrics();
  }, [fetchUserMetrics]);

  const API_BASE = useMemo(() => {
    const url = getApiUrl().replace(/\/$/, "");
    // Force HTTP for localhost to avoid SSL errors
    const httpUrl = url.replace(
      /^https:\/\/(localhost|127\.0\.0\.1)/,
      "http://$1"
    );
    return httpUrl;
  }, []);

  const activeTopicSlug = useMemo(() => {
    const interview = interviews.find((i) => i.id === selectedInterview);
    if (!isInInterview || !interview) {
      return (techTopicSlug || "bash").toLowerCase();
    }
    if (interview.type === "industry-specific") {
      return (industryTopicSlug || "aws").toLowerCase();
    }
    if (interview.type === "technical") {
      return (techTopicSlug || "bash").toLowerCase();
    }
    return "bash";
  }, [
    interviews,
    isInInterview,
    selectedInterview,
    techTopicSlug,
    industryTopicSlug,
  ]);

  const rewriteQuizAssetSrc = (src?: string): string => {
    if (!src) return "";
    if (/^(?:https?:)?\/\//i.test(src) || src.startsWith("data:")) return src;
    const noQuery = src.split("?")[0];
    const clean = noQuery.replace(/^\//, "");
    const finalUrl = `${API_BASE}/quiz-assets/${activeTopicSlug}/${clean}`;
    console.log("[rewriteQuizAssetSrc]", {
      src,
      noQuery,
      clean,
      activeTopicSlug,
      API_BASE,
      finalUrl,
    });
    return finalUrl;
  };

  const openImageModal = (src: string, alt: string = "") => {
    console.log("[ImageModal] openImageModal called", { src, alt });
    const imageSrc = rewriteQuizAssetSrc(src);
    console.log("[ImageModal] imageSrc:", imageSrc);
    setImageModalSrc(imageSrc);
    setImageModalAlt(alt);
    setImageModalError(false);
    setImageModalOpen(true);
    console.log("[ImageModal] modal state set to open");
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
    setImageModalSrc(null);
    setImageModalAlt("");
    setImageModalError(false);
  };

  const interviewTypes = [
    {
      type: "behavioral",
      title: "Behavioral Interview",
      description:
        "Practice common behavioral questions and STAR method responses on your own, with optional video recording.  Take a test and practice poise and confidence, before on-site and screening interviews where you take the real test.  Keep calm and carry on!",
      icon: Users,
      color: "bg-blue-500",
      overlayColor: "bg-blue-600/40",
      duration: "30-45 min",
      image: "/assets/pexels-photo-3183150-behavioral-team-mtg.jpeg",
      imageFirst: false,
      attribution: "Photo by Pexels",
    },
    {
      type: "technical",
      title: "Tech Challenge",
      description:
        "Try out some LinkedIn user-contributed code tests on programming topics, system design, and technical problem solving.  Be your best self in your next technical interview.",
      icon: Code,
      color: "bg-green-500",
      overlayColor: "bg-green-600/40",
      duration: "45-60 min",
      image:
        "/assets/young-adult-listening-study-music-writing-ideas-bachelor-paper.jpg",
      imageFirst: true, // Image comes first for Technical
      attribution: "Image by DC Studio on Freepik",
    },
    {
      type: "industry-specific",
      title: "Industry Specific Tests",
      description:
        "Sample this trove of LinkedIn user-contributed application- and industry-specific interview questions tailored to specialized positions, where app-knowledge is key.",
      icon: Brain,
      color: "bg-purple-500",
      overlayColor: "bg-purple-600/40",
      duration: "30-45 min",
      image: "/assets/pexels-photo-392018-apple-test.webp",
      imageFirst: false,
      attribution: "Photo by Pexels",
    },
  ];

  const resetState = () => {
    setCurrentIndex(0);
    setSelectedChoiceIds([]);
    setScoreCorrect(0);
    setScoreTotal(0);
    setFinished(false);
    setReviewMode(false);
    setSessionId(null);
    setModeLabel("Bash");
    setBehavioralResponses({});
    // Reset video recording state
    stopRecording();
  };

  // Video recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setVideoStream(stream);

      // Set stream to video element for preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setVideoChunks(chunks);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Failed to access camera/microphone. Please check permissions.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "paused") {
      mediaRecorder.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      setMediaRecorder(null);
      setIsRecording(false);
      setIsPaused(false);
    }

    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const downloadRecording = () => {
    if (recordedVideoUrl) {
      const a = document.createElement("a");
      a.href = recordedVideoUrl;
      a.download = `interview-recording-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Cleanup video recording on unmount or exit
  useEffect(() => {
    return () => {
      stopRecording();
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  // Handle ESC key to close image modal
  useEffect(() => {
    if (!imageModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeImageModal();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [imageModalOpen]);

  // Load all topics for admin panel
  useEffect(() => {
    if (adminPanelOpen && allTopics.length === 0) {
      api
        .get<any>("/quiz/topics/all")
        .then((res) => {
          setAllTopics(res);
          // Initialize categoryUpdates with current values
          const updates: Record<string, boolean> = {};
          res.forEach((t: any) => {
            updates[t.slug] = t.industry_specific;
          });
          setCategoryUpdates(updates);
        })
        .catch((e) => {
          console.error("[Admin] Failed to load topics:", e);
        });
    }
  }, [adminPanelOpen, allTopics.length]);

  const handleReloadAll = async () => {
    setReloadStatus({ loading: true, message: "Reloading all topics..." });
    try {
      const result = await api.post<any>("/quiz/reload-all");
      setReloadStatus({
        loading: false,
        message: `Reloaded ${result.succeeded}/${result.total} topics in ${result.duration}`,
      });
      // Refresh topics list
      const topics = await api.get<any>("/quiz/topics/all");
      setAllTopics(topics);
    } catch (e: any) {
      setReloadStatus({
        loading: false,
        message: `Error: ${e.message || "Reload failed"}`,
      });
    }
  };

  const handleCategoryChange = (slug: string, isIndustry: boolean) => {
    setCategoryUpdates((prev) => ({ ...prev, [slug]: isIndustry }));
  };

  const handleSaveCategories = async () => {
    const updates = Object.entries(categoryUpdates).map(
      ([slug, industry_specific]) => ({
        slug,
        industry_specific: industry_specific ? 1 : 0,
      })
    );

    try {
      await api.post("/quiz/topics/bulk-update-category", { updates });
      setReloadStatus({
        loading: false,
        message: `Updated ${updates.length} topic categories`,
      });
      // Refresh topics list
      const topics = await api.get<any>("/quiz/topics/all");
      setAllTopics(topics);
    } catch (e: any) {
      setReloadStatus({
        loading: false,
        message: `Error: ${e.message || "Update failed"}`,
      });
    }
  };

  const startInterview = (interviewId: string) => {
    setSelectedInterview(interviewId);
    setIsInInterview(true);
    resetState();
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_) {}
  };

  const exitInterview = () => {
    setIsInInterview(false);
    setSelectedInterview(null);
    setTechQuiz(null);
    resetState();
  };

  // Timer logic
  useEffect(() => {
    if (isInInterview && selectedInterview) {
      // Get duration from interview type (default to 45 minutes)
      const interview = interviews.find((i) => i.id === selectedInterview);
      const duration = String(interview?.duration || "45");
      const minutes = parseInt(duration.split("-")[0]) || 45;

      setRemainingSeconds(minutes * 60);

      // Clear any existing timer
      if (timerInterval) {
        clearInterval(timerInterval);
      }

      // Start countdown
      const interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimerInterval(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimerInterval(interval);

      return () => {
        clearInterval(interval);
        setTimerInterval(null);
      };
    } else {
      // Clear timer when exiting interview
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      setRemainingSeconds(0);
    }
  }, [isInInterview, selectedInterview, interviews]);

  // Validate DB integrity on component mount
  useEffect(() => {
    (async () => {
      try {
        const validation = await api.get<any>("/quiz/topics/validate");
        if (
          !validation.valid &&
          validation.issues &&
          validation.issues.length > 0
        ) {
          console.warn("[DB Integrity] Found issues:", validation.issues);
          // Auto-fix if there are issues
          try {
            const fixResult = await api.post<any>("/quiz/topics/fix-integrity");
            console.log("[DB Integrity] Auto-fixed:", fixResult);
          } catch (e) {
            console.error("[DB Integrity] Auto-fix failed:", e);
          }
        }
      } catch (e) {
        console.error("[DB Integrity] Validation failed:", e);
      }
    })();
  }, []); // Run once on mount

  // Fetch quiz when technical or industry-specific interview is selected
  useEffect(() => {
    const selected = interviews.find((i) => i.id === selectedInterview);
    if (
      !isInInterview ||
      !selected ||
      (selected.type !== "technical" && selected.type !== "industry-specific")
    )
      return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingQuiz(true);
        setQuizError(null);
        const defaultSlug =
          selected.type === "industry-specific" ? "aws" : "bash";
        const topic = (
          selected.type === "industry-specific"
            ? industryTopicSlug || defaultSlug
            : techTopicSlug || defaultSlug
        ).toLowerCase();
        // this is horrible....
        const topicName =
          selected.type === "industry-specific"
            ? industryTopicName || "AWS"
            : techTopicName || "Bash";
        console.log("[Fetch] calling random10 for topic", { topic, topicName });
        setModeLabel(String(topicName).toUpperCase());
        if (
          skipNextFetch &&
          techQuiz &&
          Array.isArray(techQuiz.questions) &&
          techQuiz.questions.length > 0
        ) {
          console.log("[FetchGuard] Skipping fetch due to preloaded quiz");
          setSkipNextFetch(false);
          setLoadingQuiz(false);
          return;
        }
        // request random 10 excluding recent (with fallback to ordered first 10)
        let questions: any[] = [];
        let quizMeta: any = null;
        try {
          //   obvious BUG here
          const payload = await api.get<any>(`/quiz/${topic}/random10`);
          //   obvious BUG here
          quizMeta = payload?.quiz || null;
          questions = payload?.questions || [];
          console.log("[Fetch] random10", { topic, got: questions.length });
        } catch (e) {
          console.error("[Fetch] random10 error", e);
        }
        if (!questions || questions.length === 0) {
          try {
            const latest = await api.get<any>(`/quiz/${topic}/latest`);
            quizMeta = latest || quizMeta;
            if (latest?.slug) {
              const ordered = await api.get<any>(
                `/quiz/${encodeURIComponent(latest.slug)}/questions?limit=10`
              );
              questions = ordered?.questions || [];
              console.warn("[Fetch] fallback ordered10", {
                topic,
                got: questions.length,
              });
            }
          } catch (e) {
            console.error("[Fetch] fallback ordered10 error", e);
          }
        }
        if (!cancelled) {
          setTechQuiz({ quiz: quizMeta, questions });
          setScoreTotal(questions?.length || 0);
          try {
            if (quizMeta?.slug) {
              const userId = getUserId();
              const s = await api.post<any>("/quiz/session/start", {
                user_id: userId,
                topic_slug: topic,
                quiz_slug: quizMeta.slug,
                score_total: questions?.length || 0,
              });
              if (!cancelled) setSessionId(s?.id || null);
            }
          } catch (_) {}
        }
      } catch (e: any) {
        if (!cancelled) setQuizError(e?.message || "Failed to load quiz");
      } finally {
        if (!cancelled) setLoadingQuiz(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isInInterview,
    selectedInterview,
    techTopicSlug,
    techTopicName,
    industryTopicSlug,
    industryTopicName,
  ]);

  const isTechnicalSelected = useMemo(() => {
    const interview = interviews.find((i) => i.id === selectedInterview);
    return !!(
      isInInterview &&
      interview &&
      (interview.type === "technical" || interview.type === "industry-specific")
    );
  }, [interviews, isInInterview, selectedInterview]);

  const isBehavioralSelected = useMemo(() => {
    const interview = interviews.find((i) => i.id === selectedInterview);
    return !!(isInInterview && interview && interview.type === "behavioral");
  }, [interviews, isInInterview, selectedInterview]);

  const currentQuestion = useMemo(() => {
    if (!techQuiz || !techQuiz.questions || techQuiz.questions.length === 0)
      return null;
    return (
      techQuiz.questions[
        Math.min(currentIndex, techQuiz.questions.length - 1)
      ] || null
    );
  }, [techQuiz, currentIndex]);

  const isMultiCorrect = useMemo(() => {
    if (!currentQuestion) return false;
    const correct = (currentQuestion.choices || []).filter(
      (c: any) => c.is_correct
    );
    return correct.length > 1;
  }, [currentQuestion]);

  const toggleSelectChoice = (choiceId: number) => {
    if (!currentQuestion) return;
    setReviewMode(false);
    if (isMultiCorrect) {
      setSelectedChoiceIds((prev) =>
        prev.includes(choiceId)
          ? prev.filter((id) => id !== choiceId)
          : [...prev, choiceId]
      );
    } else {
      setSelectedChoiceIds((prev) => (prev[0] === choiceId ? [] : [choiceId]));
    }
  };

  const evaluateAndNext = async () => {
    if (!currentQuestion) return;
    const correctIds = new Set<number>(
      (currentQuestion.choices || [])
        .filter((c: any) => c.is_correct)
        .map((c: any) => c.id)
    );
    const selected = new Set<number>(selectedChoiceIds);
    let isCorrect = true;
    if (correctIds.size !== selected.size) {
      isCorrect = false;
    } else {
      for (const id of correctIds) {
        if (!selected.has(id)) {
          isCorrect = false;
          break;
        }
      }
    }
    setScoreCorrect((prev) => prev + (isCorrect ? 1 : 0));
    try {
      if (sessionId) {
        await api.post<any>(`/quiz/session/${sessionId}/answer`, {
          question_id: currentQuestion.id,
          selected_choice_ids: Array.from(selected),
          is_correct: isCorrect,
        });
      }
    } catch (_) {}
    if (!techQuiz) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= techQuiz.questions.length) {
      setFinished(true);
      try {
        if (sessionId) {
          await api.post<any>(`/quiz/session/${sessionId}/complete`, {
            score_correct: scoreCorrect + (isCorrect ? 1 : 0),
            duration_ms: null,
          });
          // Calculate new score and update localStorage immediately
          const finalScore = scoreCorrect + (isCorrect ? 1 : 0);
          const scorePercentage = Math.round((finalScore / scoreTotal) * 100);

          // Determine if this is technical or industry based on interview type
          const interview = interviews.find((i) => i.id === selectedInterview);
          const isIndustry = interview?.type === "industry-specific";

          // Update the appropriate score in localStorage
          const persisted = getPersistedScores();
          if (isIndustry) {
            const newIndustryScore = Math.max(
              persisted.industryHighScore,
              scorePercentage
            );
            saveScoresToLocalStorage(
              persisted.technicalHighScore,
              newIndustryScore
            );
            setUserMetrics((prev) => ({
              ...prev,
              industryHighScore: newIndustryScore,
            }));
          } else {
            const newTechScore = Math.max(
              persisted.technicalHighScore,
              scorePercentage
            );
            saveScoresToLocalStorage(newTechScore, persisted.industryHighScore);
            setUserMetrics((prev) => ({
              ...prev,
              technicalHighScore: newTechScore,
            }));
          }

          // Wait a moment for DB commit, then refresh metrics from backend (will merge with localStorage)
          setTimeout(() => {
            fetchUserMetrics();
          }, 500);
        }
      } catch (_) {}
    } else {
      setCurrentIndex(nextIndex);
      setSelectedChoiceIds([]);
      setReviewMode(false);
    }
  };

  if (isInInterview && selectedInterview) {
    const interview = interviews.find((i) => i.id === selectedInterview);
    if (!interview) return null;

    const qCount = isTechnicalSelected
      ? techQuiz?.questions?.length || 0
      : interview.questions.length;

    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-white p-2 sm:p-4 md:p-8">
        {/* Preparing overlay during ETL/loading */}

        {loadingQuiz && (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 sm:px-6 sm:py-4 shadow-xl text-center mx-4">
              <p className="text-base sm:text-lg font-semibold text-white">
                Preparing your quiz…
              </p>
              <p className="text-xs sm:text-sm text-gray-300 mt-1">
                This may take a moment.
              </p>
            </div>
          </div>
        )}

        {/* Image Modal */}
        {imageModalOpen && imageModalSrc && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={closeImageModal}
            tabIndex={-1}
          >
            <div
              className="relative max-w-5xl max-h-[90vh] w-full mx-2 sm:mx-4 bg-white dark:bg-gray-900 rounded-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeImageModal}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 bg-gray-800 hover:bg-gray-700 text-white rounded-full p-1.5 sm:p-2 transition-colors"
                aria-label="Close image"
              >
                <X size={18} className="sm:w-6 sm:h-6" />
              </button>
              <div className="p-2 sm:p-4 overflow-auto max-h-[90vh]">
                {imageModalError ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="text-red-400 mb-4">
                      <Image size={48} className="mx-auto mb-2 opacity-50" />
                    </div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Image Not Found
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-400 mb-4">
                      The requested image could not be loaded.
                    </p>
                    <p className="text-xs text-gray-500 break-all">
                      {imageModalSrc}
                    </p>
                  </div>
                ) : (
                  <img
                    src={imageModalSrc || ""}
                    alt={imageModalAlt || "Quiz image"}
                    className="max-w-full h-auto rounded border border-gray-700 mx-auto"
                    onError={(e) => {
                      console.error("[ImageModal] Image failed to load:", {
                        src: imageModalSrc,
                        activeTopicSlug,
                        API_BASE,
                        error: e,
                      });
                      setImageModalError(true);
                    }}
                    onLoad={() => {
                      setImageModalError(false);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl text-gray-800 dark:text-white font-bold">
                Mock Interview
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
                {interview.type.charAt(0).toUpperCase() +
                  interview.type.slice(1)}{" "}
                Interview • {interview.duration} minutes
              </p>
              {isTechnicalSelected && (
                <p className="text-gray-400 mt-1 text-xs sm:text-sm">
                  Score out of {scoreTotal}: {scoreCorrect}/{currentIndex}
                </p>
              )}
            </div>
            <button
              onClick={exitInterview}
              className="bg-red-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              End Interview
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl p-3 sm:p-4 md:p-8 mb-4 sm:mb-8 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg md:text-xl font-bold">
                Question {Math.min(currentIndex + 1, qCount)} of {qCount}
              </h2>
              <div className="flex items-center bg-gray-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base">
                <Clock size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span
                  className={
                    remainingSeconds <= 300 ? "text-red-400" : "text-white"
                  }
                >
                  {formatTime(remainingSeconds)}
                </span>
              </div>
            </div>

            {!isTechnicalSelected && (
              <div className="mb-4 sm:mb-6">
                <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 sm:p-4 md:p-6">
                  <h3 className="text-base sm:text-lg font-medium mb-2">
                    Behavioral
                  </h3>
                  {!finished ? (
                    <p className="text-base sm:text-lg md:text-xl">
                      {interview.questions[currentIndex]?.question}
                    </p>
                  ) : (
                    <div className="text-center">
                      <h4 className="text-xl sm:text-2xl font-bold mb-2">
                        Session Complete
                      </h4>
                      <p className="text-gray-200 text-sm sm:text-base">
                        Great work! You answered {qCount} prompts.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isTechnicalSelected && (
              <div className="mb-4 sm:mb-6">
                <div className="bg-green-900 border border-green-700 rounded-lg p-3 sm:p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <h3 className="text-sm sm:text-base md:text-lg font-medium mb-1 sm:mb-2">
                      {modeLabel} • Multiple Choice
                    </h3>
                    {!finished && (
                      <button
                        onClick={() => setReviewMode((v) => !v)}
                        className="text-xs text-gray-300 flex items-center gap-1 hover:text-white self-start sm:self-auto"
                      >
                        <Eye size={14} className="sm:w-4 sm:h-4" />{" "}
                        <span className="hidden sm:inline">
                          {reviewMode ? "Hide answer" : "Show answer"}
                        </span>
                        <span className="sm:hidden">
                          {reviewMode ? "Hide" : "Show"}
                        </span>
                      </button>
                    )}
                  </div>
                  {loadingQuiz && (
                    <p className="text-gray-300">Loading quiz…</p>
                  )}
                  {quizError && <p className="text-red-300">{quizError}</p>}
                  {!loadingQuiz &&
                    !quizError &&
                    techQuiz &&
                    techQuiz.questions.length > 0 &&
                    !finished &&
                    currentQuestion && (
                      <div>
                        <div className="text-sm sm:text-base md:text-xl mb-3 sm:mb-4 prose prose-invert max-w-none prose-sm sm:prose-base md:prose-lg">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              img: ({ src, alt }: any) => {
                                console.log(
                                  "[ImageModal] img component rendered in prompt",
                                  { src, alt }
                                );
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log(
                                        "[ImageModal] prompt button clicked",
                                        { src, alt }
                                      );
                                      openImageModal(src || "", alt || "");
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    className="inline-flex items-center gap-1 sm:gap-2 text-blue-400 hover:text-blue-300 transition-colors my-1 sm:my-2 cursor-pointer z-10 relative text-xs sm:text-sm"
                                  >
                                    <Image
                                      size={14}
                                      className="sm:w-[18px] sm:h-[18px]"
                                    />
                                    <span className="font-medium">
                                      View Image{alt ? `: ${alt}` : ""}
                                    </span>
                                  </button>
                                );
                              },
                            }}
                          >
                            {`Q${currentQuestion.number_in_source}. ${String(
                              currentQuestion.prompt_md || ""
                            )}`}
                          </ReactMarkdown>
                        </div>
                        {/* "Dumb" fallback: attempt numbered image even if prompt markdown omitted or failed */}
                        <button
                          type="button"
                          hidden={true}
                          disabled={true}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log(
                              "[ImageModal] fallback button clicked",
                              { questionNum: currentQuestion.number_in_source }
                            );
                            openImageModal(
                              `images/Q${currentQuestion.number_in_source}.png`,
                              `Q${currentQuestion.number_in_source} prompt`
                            );
                          }}
                          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-4 cursor-pointer"
                        >
                          {/* <Image size={18} /> */}
                          {/* <span className="text-sm text-green-500 font-medium">View Question Image</span> */}
                        </button>
                        {currentQuestion.code_md && (
                          <pre className="bg-gray-900 text-gray-100 p-2 sm:p-3 md:p-4 rounded mb-3 sm:mb-4 overflow-auto text-xs sm:text-sm md:text-base">
                            {currentQuestion.code_md}
                          </pre>
                        )}
                        <div className="space-y-1.5 sm:space-y-2">
                          {currentQuestion.choices.map((c: any) => {
                            const isSelected = selectedChoiceIds.includes(c.id);
                            const isCorrect = !!c.is_correct;
                            const border = isSelected
                              ? "border-blue-500"
                              : "border-gray-700";
                            const reviewBorder = reviewMode
                              ? isCorrect
                                ? "border-green-500"
                                : isSelected
                                ? "border-red-500"
                                : border
                              : border;
                            return (
                              <label
                                key={c.id}
                                className={`flex items-start space-x-2 sm:space-x-3 bg-gray-900 p-2 sm:p-3 rounded border ${reviewBorder}`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 sm:mt-1 flex-shrink-0"
                                  checked={isSelected}
                                  onChange={() => toggleSelectChoice(c.id)}
                                />
                                <div className="text-gray-100 prose prose-invert max-w-none prose-sm sm:prose-base text-xs sm:text-sm md:text-base">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      img: ({ src, alt }: any) => {
                                        console.log(
                                          "[ImageModal] img component rendered in choice",
                                          { src, alt }
                                        );
                                        return (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              console.log(
                                                "[ImageModal] choice button clicked",
                                                { src, alt }
                                              );
                                              openImageModal(
                                                src || "",
                                                alt || ""
                                              );
                                            }}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                            }}
                                            className="inline-flex items-center gap-1 sm:gap-2 text-blue-400 hover:text-blue-300 transition-colors my-1 sm:my-2 cursor-pointer z-10 relative text-xs sm:text-sm"
                                          >
                                            <Image
                                              size={14}
                                              className="sm:w-[18px] sm:h-[18px]"
                                            />
                                            <span className="font-medium">
                                              View Image{alt ? `: ${alt}` : ""}
                                            </span>
                                          </button>
                                        );
                                      },
                                    }}
                                  >
                                    {String(c.label_md || "")}
                                  </ReactMarkdown>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        {currentQuestion.explanation_md && (
                          <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-300">
                            <div className="font-semibold mb-1">
                              Explanation
                            </div>
                            <div className="prose prose-invert max-w-none prose-sm sm:prose-base">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  img: ({ src, alt }: any) => {
                                    console.log(
                                      "[ImageModal] img component rendered in explanation",
                                      { src, alt }
                                    );
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log(
                                            "[ImageModal] explanation button clicked",
                                            { src, alt }
                                          );
                                          openImageModal(src || "", alt || "");
                                        }}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                        }}
                                        className="inline-flex items-center gap-1 sm:gap-2 text-blue-400 hover:text-blue-300 transition-colors my-1 sm:my-2 cursor-pointer z-10 relative text-xs sm:text-sm"
                                      >
                                        <Image
                                          size={14}
                                          className="sm:w-[18px] sm:h-[18px]"
                                        />
                                        <span className="font-medium">
                                          View Image{alt ? `: ${alt}` : ""}
                                        </span>
                                      </button>
                                    );
                                  },
                                }}
                              >
                                {String(currentQuestion.explanation_md || "")}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                        {currentQuestion.reference_url && (
                          <div className="mt-2 text-sm">
                            <a
                              className="text-blue-300 underline"
                              href={currentQuestion.reference_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Reference
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  {finished && (
                    <div className="text-center">
                      <h4 className="text-xl sm:text-2xl font-bold mb-2">
                        Quiz Complete
                      </h4>
                      <p className="text-gray-200 text-sm sm:text-base">
                        Your score: {scoreCorrect}/{scoreTotal}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 sm:mt-6 text-[10px] sm:text-xs text-gray-400">
                    Quiz content courtesy of{" "}
                    <a
                      className="underline"
                      href="https://github.com/Ebazhanov/linkedin-skill-assessments-quizzes"
                      target="_blank"
                      rel="noreferrer"
                    >
                      LinkedIn Skill Assessments (Community)
                    </a>{" "}
                    (commit 6a818e3).
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              {!isTechnicalSelected && (
                <>
                  <h3 className="text-base sm:text-lg font-medium">
                    Your Response:
                  </h3>

                  {/* Video Preview */}
                  {isRecording && (
                    <div className="mb-3 sm:mb-4">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full max-w-md rounded-lg border border-gray-600 bg-black"
                        style={{ maxHeight: "200px" }}
                      />
                      {isPaused && (
                        <div className="mt-2 text-yellow-400 text-xs sm:text-sm">
                          ⏸️ Recording Paused
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recorded Video Playback */}
                  {recordedVideoUrl && !isRecording && (
                    <div className="mb-3 sm:mb-4">
                      <h4 className="text-xs sm:text-sm font-medium mb-2">
                        Recorded Video:
                      </h4>
                      <video
                        ref={recordedVideoRef}
                        src={recordedVideoUrl}
                        controls
                        className="w-full max-w-md rounded-lg border border-gray-600 bg-black"
                        style={{ maxHeight: "200px" }}
                      />
                    </div>
                  )}

                  <textarea
                    className="w-full h-24 sm:h-32 bg-gray-700 border border-gray-600 rounded-lg p-2 sm:p-3 md:p-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="Start speaking or type your response here..."
                    value={
                      !isTechnicalSelected
                        ? behavioralResponses[currentIndex] || ""
                        : undefined
                    }
                    onChange={
                      !isTechnicalSelected
                        ? (e) =>
                            setBehavioralResponses((prev) => ({
                              ...prev,
                              [currentIndex]: e.target.value,
                            }))
                        : undefined
                    }
                  />
                </>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                {!isTechnicalSelected && (
                  <div className="flex flex-wrap gap-2">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="bg-blue-600 text-white px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                      >
                        🎤 Start Recording
                      </button>
                    ) : (
                      <>
                        {isPaused ? (
                          <button
                            onClick={resumeRecording}
                            className="bg-green-600 text-white px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
                          >
                            ▶️ Resume
                          </button>
                        ) : (
                          <button
                            onClick={pauseRecording}
                            className="bg-yellow-600 text-white px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm sm:text-base"
                          >
                            ⏸️ Pause
                          </button>
                        )}
                        <button
                          onClick={stopRecording}
                          className="bg-red-600 text-white px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base"
                        >
                          ⏹️ Stop
                        </button>
                      </>
                    )}
                    {recordedVideoUrl && (
                      <button
                        onClick={downloadRecording}
                        className="bg-purple-600 text-white px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base"
                      >
                        💾 Download
                      </button>
                    )}
                  </div>
                )}
                {isTechnicalSelected ? (
                  <button
                    disabled={!finished && selectedChoiceIds.length === 0}
                    onClick={finished ? exitInterview : evaluateAndNext}
                    className={`px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg transition-colors ${
                      finished
                        ? "bg-purple-600 hover:bg-purple-700"
                        : selectedChoiceIds.length > 0
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-600 cursor-not-allowed"
                    } text-white text-sm sm:text-base whitespace-nowrap`}
                  >
                    {finished ? "Finish" : "Next Question →"}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const next = currentIndex + 1;
                      if (next >= qCount) {
                        if (!finished) {
                          setFinished(true);
                          // Track behavioral completion - each question completed counts
                          // There are 5 behavioral questions total, so completing all = 100%
                          incrementBehavioralCompletion();
                          // Refresh metrics to update display
                          setTimeout(() => {
                            fetchUserMetrics();
                          }, 100);
                        } else {
                          exitInterview();
                        }
                      } else {
                        setCurrentIndex(next);
                      }
                    }}
                    className={`px-4 py-1.5 sm:px-6 sm:py-2 rounded-lg transition-colors ${
                      finished
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-green-600 hover:bg-green-700"
                    } text-white text-sm sm:text-base whitespace-nowrap`}
                  >
                    {finished ? "Exit" : "Next Question →"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {isBehavioralSelected && (
            <>
              <div className="bg-gray-800 rounded-xl p-3 sm:p-4 md:p-6">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">
                  💡 Interview Tips
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <h4 className="font-medium text-blue-300 mb-2">
                      STAR Method:
                    </h4>
                    <ul className="space-y-1 text-gray-300">
                      <li>
                        • <strong>S</strong>ituation - Set the context
                      </li>
                      <li>
                        • <strong>T</strong>ask - Describe your responsibility
                      </li>
                      <li>
                        • <strong>A</strong>ction - Explain what you did
                      </li>
                      <li>
                        • <strong>R</strong>esult - Share the outcomes
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-green-300 mb-2">
                      Best Practices:
                    </h4>
                    <ul className="space-y-1 text-gray-300">
                      <li>• Be specific with examples</li>
                      <li>• Focus on your contributions</li>
                      <li>• Quantify results when possible</li>
                      <li>• Stay positive and professional</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Admin Panel - Collapsible */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="w-full flex items-center justify-between p-4">
          <button
            onClick={() => setAdminPanelOpen(!adminPanelOpen)}
            className="flex items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg px-2 py-1 -ml-2"
          >
            <Settings
              size={20}
              className="text-gray-600 dark:text-gray-300 mr-2"
            />
            <span className="font-semibold text-gray-900 dark:text-white">
              Administration
            </span>
            <div className="ml-2">
              {adminPanelOpen ? (
                <ChevronUp
                  size={20}
                  className="text-gray-600 dark:text-gray-300"
                />
              ) : (
                <ChevronDown
                  size={20}
                  className="text-gray-600 dark:text-gray-300"
                />
              )}
            </div>
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle dark mode"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <Sun size={20} className="text-yellow-500" />
            ) : (
              <Moon size={20} className="text-gray-600 dark:text-gray-300" />
            )}
          </button>
        </div>

        {adminPanelOpen && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-6">
            {/* Reload Database Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Reload Database
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Re-import all topics from local files. This updates questions
                with latest fixes while preserving your category settings.
              </p>
              <button
                onClick={handleReloadAll}
                disabled={reloadStatus.loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
              >
                {reloadStatus.loading ? (
                  <>
                    <RefreshCw size={16} className="mr-2 animate-spin" />
                    Reloading...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} className="mr-2" />
                    Reload All Topics
                  </>
                )}
              </button>
              {reloadStatus.message && (
                <p
                  className={`mt-2 text-sm ${
                    reloadStatus.message.startsWith("Error")
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {reloadStatus.message}
                </p>
              )}
            </div>

            {/* Clear Stats Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Clear Stats
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Clear all your session statistics including high scores and
                completion counts. This action cannot be undone.
              </p>
              <button
                onClick={clearAllStats}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
              >
                Clear All Stats
              </button>
            </div>

            {/* Category Management Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Topic Categories
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Change which topics are Technical vs Industry-Specific. Changes
                are saved when you click "Save Categories".
              </p>
              <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white">
                        Topic Name
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white">
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTopics.map(
                      (topic: {
                        slug: string;
                        name: string;
                        industry_specific: boolean;
                      }) => {
                        // Display slug if name is null, empty, or the string "null"
                        const displayName =
                          topic.name &&
                          topic.name !== "null" &&
                          topic.name.trim() !== ""
                            ? topic.name
                            : topic.slug;
                        return (
                          <tr
                            key={topic.slug}
                            className="border-t border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                              {displayName}
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={
                                  categoryUpdates[topic.slug]
                                    ? "industry"
                                    : "technical"
                                }
                                onChange={(e) =>
                                  handleCategoryChange(
                                    topic.slug,
                                    e.target.value === "industry"
                                  )
                                }
                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              >
                                <option value="technical">Technical</option>
                                <option value="industry">
                                  Industry-Specific
                                </option>
                              </select>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleSaveCategories}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save Categories
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Upskill Studio
        </h1>
        <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-4">
          Grab a coffee. Choose a room. Prepare to shine.
        </h3>
        <div className="space-y-6">
          {interviewTypes.map((type) => {
            const Icon = type.icon;
            const imageFirst = type.imageFirst || false;
            // Render image column component
            const ImageColumn = () => {
              const [imageError, setImageError] = React.useState(false);

              return (
                <div
                  className={`relative h-full min-h-[300px] overflow-hidden ${
                    imageFirst
                      ? "md:rounded-l-xl rounded-t-xl md:rounded-br-none"
                      : "md:rounded-r-xl rounded-b-xl md:rounded-bl-none"
                  }`}
                >
                  {type.image && !imageError ? (
                    <>
                      <img
                        src={type.image}
                        alt={type.title}
                        className="w-full h-full object-cover"
                        style={{
                          filter: "grayscale(40%) brightness(0.9)",
                          transition: "filter 0.3s ease",
                        }}
                        onError={(e) => {
                          console.error(
                            "[Image] Failed to load:",
                            type.image,
                            e
                          );
                          setImageError(true);
                        }}
                        onLoad={() => {
                          console.log(
                            "[Image] Successfully loaded:",
                            type.image
                          );
                        }}
                      />
                      <div
                        className="absolute inset-0 mix-blend-overlay"
                        style={{
                          backgroundColor:
                            type.type === "behavioral"
                              ? "rgba(37, 99, 235, 0.3)"
                              : type.type === "technical"
                              ? "rgba(34, 197, 94, 0.3)"
                              : "rgba(168, 85, 247, 0.3)",
                        }}
                      ></div>
                      {type.attribution && (
                        <div className="absolute bottom-2 right-2 text-xs text-white/80 bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-shadow">
                          {type.attribution}
                        </div>
                      )}
                    </>
                  ) : (
                    <div
                      className={`w-full h-full ${type.color} flex items-center justify-center`}
                    >
                      <div className="text-white/50 text-center p-4">
                        <Icon size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {imageError
                            ? "Image failed to load"
                            : "Image coming soon"}
                        </p>
                        {imageError && (
                          <p className="text-xs mt-1 opacity-75">
                            Path: {type.image}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div
                key={type.type}
                className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all"
              >
                {/* Render image first if imageFirst is true, otherwise render card first */}
                {imageFirst && <ImageColumn />}

                {/* Card Content */}
                <div
                  className={`bg-white dark:bg-gray-800 ${
                    imageFirst
                      ? "md:rounded-r-xl md:rounded-l-none rounded-b-xl md:rounded-tl-none"
                      : "md:rounded-l-xl rounded-t-xl md:rounded-tr-none"
                  } p-6 flex flex-col`}
                >
                  <div
                    className={`w-12 h-12 ${type.color} rounded-lg flex items-center justify-center mb-4`}
                  >
                    <Icon size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {type.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {type.description}
                  </p>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <Clock size={16} className="mr-2" />
                    <span>{type.duration}</span>
                  </div>
                  {(type.type === "technical" ||
                    type.type === "industry-specific") && (
                    <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                      <div className="mb-1">
                        <span className="font-bold">Current Topic:</span>
                        {type.type === "industry-specific" ? (
                          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-md ml-2">
                            {industryTopicName || "AWS"}
                          </span>
                        ) : (
                          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-md ml-2">
                            {techTopicName || "Bash"}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          const modalType =
                            type.type === "technical"
                              ? "technical"
                              : "industry";
                          console.log(
                            "========================================"
                          );
                          console.log("[TopicModal] BUTTON CLICKED:", {
                            cardType: type.type,
                            modalType,
                            timestamp: new Date().toISOString(),
                          });

                          setShowTopicModal(modalType);
                          console.log(
                            "[TopicModal] State cleared - availableTopics set to []"
                          );
                          setAvailableTopics([]); // Clear previous topics immediately

                          try {
                            const isIndustry =
                              type.type === "industry-specific";
                            const flag = isIndustry ? "1" : "0";
                            const url = `/quiz/topics/by-category-with-files?industry_specific=${flag}`;
                            console.log("[TopicModal] ABOUT TO FETCH:", {
                              cardType: type.type,
                              modalType,
                              isIndustry,
                              flag,
                              url,
                              fullUrl: `http://localhost:3010/api${url}`,
                            });

                            // Load ALL topics from quiz_topic table filtered by category flag
                            const startTime = Date.now();
                            let topics: any;
                            try {
                              topics = await api.get<any>(url);
                            } catch (e) {
                              console.error("[TopicModal] -0- FETCH ERROR:", e);
                              topics = [];
                            }
                            const fetchTime = Date.now() - startTime;

                            console.log(
                              "[TopicModal] -0- RAW RESPONSE:",
                              topics
                            );
                            console.log("[TopicModal] -0- RESPONSE TYPE:", {
                              cardType: type.type,
                              modalType,
                              isIndustry,
                              flag,
                              fetchTime: `${fetchTime}ms`,
                              topicsType: typeof topics,
                              isArray: Array.isArray(topics),
                              isNull: topics === null,
                              isUndefined: topics === undefined,
                              constructor: topics?.constructor?.name,
                              keys:
                                topics && typeof topics === "object"
                                  ? Object.keys(topics)
                                  : "N/A",
                            });

                            // Ensure topics is an array
                            if (!Array.isArray(topics)) {
                              console.error(
                                "[TopicModal] -0- RESPONSE IS NOT ARRAY:",
                                topics
                              );
                              topics = [];
                            }

                            console.log("[TopicModal] -0- PROCESSED:", {
                              count: topics?.length || 0,
                              first5: Array.isArray(topics)
                                ? topics.slice(0, 5).map((t: any) => ({
                                    slug: t.topic_slug,
                                    name: t.topic_name,
                                    hasAdobe: t.topic_slug?.includes("adobe"),
                                    hasAws: t.topic_slug?.includes("aws"),
                                  }))
                                : "NOT AN ARRAY",
                            });

                            const allTopics = (topics || []).map((t: any) => ({
                              topic_slug: t.topic_slug,
                              topic_name: t.topic_name,
                              file: t.file,
                              cached: t.cached,
                            }));

                            console.log("[TopicModal] -0- MAPPED TOPICS:", {
                              cardType: type.type,
                              modalType,
                              count: allTopics.length,
                              first3Slugs: allTopics
                                .slice(0, 3)
                                .map((t) => t.topic_slug),
                              hasAdobe: allTopics.some((t) =>
                                t.topic_slug?.includes("adobe")
                              ),
                              hasAws: allTopics.some((t) =>
                                t.topic_slug?.includes("aws")
                              ),
                              hasAccounting: allTopics.some((t) =>
                                t.topic_slug?.includes("accounting")
                              ),
                            });

                            console.log(
                              "[TopicModal] -0- SETTING STATE - availableTopics =",
                              allTopics.length,
                              "topics"
                            );
                            setAvailableTopics(allTopics);
                            console.log("[TopicModal] -0- STATE SET COMPLETE");
                            console.log(
                              "========================================"
                            );
                          } catch (e) {
                            console.error("[TopicModal] |XXX| EXCEPTION:", e);
                            setAvailableTopics([]);
                          }
                        }}
                        className="text-left text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors cursor-pointer"
                      >
                        Select New Topic
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() =>
                      startInterview(
                        interviews.find((i) => i.type === type.type)?.id || ""
                      )
                    }
                    className="w-full bg-blue-600 dark:bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center justify-center mt-auto"
                  >
                    <Play size={16} className="mr-2" />
                    Start Interview
                  </button>
                </div>

                {/* Render image second if imageFirst is false */}
                {!imageFirst && <ImageColumn />}
              </div>
            );
          })}
        </div>
      </div>
      {/* User Metrics / Gamification Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Recent Highlights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Technical Test High Score */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6 border border-green-200 dark:border-green-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Code
                  size={24}
                  className="text-green-600 dark:text-green-400 mr-2"
                />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tech Challenge
                </h3>
              </div>
              {userMetrics.technicalHighScore > 0 && (
                <button
                  onClick={clearTechnicalScore}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Clear this score"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
              {userMetrics.technicalHighScore}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              High Score
            </p>
            {userMetrics.technicalHighScore === 0 && (
              <p className="text-xs text-green-700 dark:text-green-300 italic">
                Try a technical test to set your first score!
              </p>
            )}
          </div>

          {/* Industry-Specific Test High Score */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-6 border border-purple-200 dark:border-purple-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Brain
                  size={24}
                  className="text-purple-600 dark:text-purple-400 mr-2"
                />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Industry Tests
                </h3>
              </div>
              {userMetrics.industryHighScore > 0 && (
                <button
                  onClick={clearIndustryScore}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Clear this score"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {userMetrics.industryHighScore}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              High Score
            </p>
            {userMetrics.industryHighScore === 0 && (
              <p className="text-xs text-purple-700 dark:text-purple-300 italic">
                Try an industry-specific test to set your first score!
              </p>
            )}
          </div>

          {/* Behavioral Interview Completions */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Users
                  size={24}
                  className="text-blue-600 dark:text-blue-400 mr-2"
                />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Mock Interviews
                </h3>
              </div>
              {userMetrics.behavioralCompletions > 0 && (
                <button
                  onClick={clearBehavioralCompletions}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Clear this completion count"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {userMetrics.behavioralCompletions}/5
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {Math.round((userMetrics.behavioralCompletions / 5) * 100)}%
              Complete
            </p>
            {userMetrics.behavioralCompletions < 5 && (
              <p className="text-xs text-blue-700 dark:text-blue-300 italic">
                {userMetrics.behavioralCompletions === 0
                  ? " Complete all 5 mock interview practices to unlock your achievement!"
                  : ` ${
                      5 - userMetrics.behavioralCompletions
                    } more practice sessions${
                      5 - userMetrics.behavioralCompletions === 1 ? "" : "s"
                    } to go!`}
              </p>
            )}
            {userMetrics.behavioralCompletions >= 5 && (
              <p className="text-xs text-green-700 dark:text-green-300 font-semibold">
                <Award size={24} className="text-green-600 dark:text-green-400 mr-2"/> Achievement Unlocked! Great work!
              </p>
            )}
          </div>
        </div>
      </div>
      {/* Topic Selection Modal */}
      {showTopicModal && (
        <div
          key={showTopicModal}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50"
        >
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-full max-w-2xl rounded-lg shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                Select{" "}
                {showTopicModal === "industry"
                  ? "Industry-Specific"
                  : "Technical"}{" "}
                Topic
              </h3>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="max-h-96 overflow-auto border border-gray-200 dark:border-gray-700 rounded">
              {availableTopics.length === 0 ? (
                <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
                  No topics discovered. Ensure QUIZ_REPO_ROOT is configured, the
                  repository exists, and the quiz database is intact.
                </div>
              ) : (
                <ul>
                  {availableTopics.map((t) => (
                    <li
                      key={t.topic_slug}
                      className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t.topic_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t.topic_slug} {t.cached ? "• cached" : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.cached ? (
                          <button
                            onClick={() => {
                              // show preparing overlay immediately
                              setLoadingQuiz(true);
                              console.log("[UseTopic] selected", {
                                card: showTopicModal,
                                topic_slug: t.topic_slug,
                                topic_name: t.topic_name,
                                cached: true,
                              });
                              if (showTopicModal === "industry") {
                                setIndustryTopicSlug(
                                  t.topic_slug.toLowerCase()
                                );
                                setIndustryTopicName(t.topic_name);
                                setShowTopicModal(false);
                                const id =
                                  interviews.find(
                                    (i) => i.type === "industry-specific"
                                  )?.id || "";
                                if (id) {
                                  setSkipNextFetch(false);
                                  startInterview(id);
                                }
                              } else {
                                setTechTopicSlug(t.topic_slug.toLowerCase());
                                setTechTopicName(t.topic_name);
                                setShowTopicModal(false);
                                const id =
                                  interviews.find((i) => i.type === "technical")
                                    ?.id || "";
                                if (id) {
                                  setSkipNextFetch(false);
                                  startInterview(id);
                                }
                              }
                            }}
                            className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                          >
                            Use Topic
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                // show preparing overlay immediately
                                setLoadingQuiz(true);
                                const isIndustry =
                                  showTopicModal === "industry";
                                console.log("[LoadTopic] importing", {
                                  card: showTopicModal,
                                  topic_slug: t.topic_slug,
                                  file: t.file,
                                  isIndustry,
                                });
                                console.log("[LoadTopic] importing", {
                                  FILE_PATH: t.file,
                                });
                                await api.post<any>("/quiz/import-local", {
                                  topic_slug: t.topic_slug,
                                  topic_name: t.topic_name,
                                  local_file: t.file,
                                  industry_specific: isIndustry ? "1" : "0",
                                });
                                console.log("[LoadTopic] import complete");
                                // Pre-fetch to avoid zero-of-zero race
                                const topicSlug = t.topic_slug.toLowerCase();
                                const payload = await api.get<any>(
                                  `/quiz/${topicSlug}/random10`
                                );
                                const questions: any[] =
                                  payload.questions || [];
                                if (!questions || questions.length === 0) {
                                  console.error(
                                    "[LoadTopic] prefetch returned 0 questions",
                                    { topicSlug }
                                  );
                                }
                                setTechQuiz({ quiz: payload.quiz, questions });
                                setScoreTotal(questions.length || 0);
                                if (showTopicModal === "industry") {
                                  setIndustryTopicSlug(
                                    t.topic_slug.toLowerCase()
                                  );
                                  setIndustryTopicName(t.topic_name);
                                  setShowTopicModal(false);
                                  const id =
                                    interviews.find(
                                      (i) => i.type === "industry-specific"
                                    )?.id || "";
                                  if (id) {
                                    setSkipNextFetch(true);
                                    startInterview(id);
                                  }
                                } else {
                                  setTechTopicSlug(t.topic_slug.toLowerCase());
                                  setTechTopicName(t.topic_name);
                                  setShowTopicModal(false);
                                  const id =
                                    interviews.find(
                                      (i) => i.type === "technical"
                                    )?.id || "";
                                  if (id) {
                                    setSkipNextFetch(true);
                                    startInterview(id);
                                  }
                                }
                              } catch (e) {
                                console.error("[LoadTopic] import error", e);
                                // keep modal open; optionally show error in future
                              }
                            }}
                            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Load Topic
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 text-right">
              <button
                onClick={() => setShowTopicModal(false)}
                className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockInterviews;
